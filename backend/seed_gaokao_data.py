"""
种子脚本：从 seed_gaokao_data.json 导入院校和录取分数线数据
在启动时自动运行（仅当 College 表为空时）
"""
import sys
import os
import json
import logging

sys.path.insert(0, '.')
logger = logging.getLogger(__name__)

DATA_FILE = os.path.join(os.path.dirname(__file__), 'seed_gaokao_data.json')

# 导入时跳过的字段（让数据库自动生成）
_SKIP_FIELDS = {'id', 'created_at', 'updated_at'}


def seed_gaokao_data():
    """导入院校 + 录取分数线数据"""
    from db import SessionLocal, init_db
    from models import College, Score

    if not os.path.exists(DATA_FILE):
        logger.warning(f"种子数据文件不存在: {DATA_FILE}")
        return False

    db = SessionLocal()

    # 仅在院校表为空时导入
    college_count = db.query(College).count()
    if college_count > 0:
        logger.info(f"院校表已有 {college_count} 条数据，跳过导入")
        db.close()
        return True

    try:
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # 导入院校（分批提交避免内存问题）
        colleges = data.get('colleges', [])
        batch_size = 500
        for i in range(0, len(colleges), batch_size):
            batch = colleges[i:i + batch_size]
            for c_data in batch:
                filtered = {k: v for k, v in c_data.items() if k not in _SKIP_FIELDS}
                college = College(**filtered)
                db.add(college)
            db.commit()
            logger.info(f"院校导入进度: {min(i + batch_size, len(colleges))}/{len(colleges)}")

        # 导入录取分数线（分批提交）
        scores = data.get('scores', [])
        for i in range(0, len(scores), batch_size):
            batch = scores[i:i + batch_size]
            for s_data in batch:
                filtered = {k: v for k, v in s_data.items() if k not in _SKIP_FIELDS}
                score = Score(**filtered)
                db.add(score)
            db.commit()
            logger.info(f"录取数据导入进度: {min(i + batch_size, len(scores))}/{len(scores)}")

        logger.info(f"导入完成: {len(colleges)} 所院校, {len(scores)} 条录取记录")
        return True

    except Exception as e:
        logger.error(f"导入失败: {e}")
        db.rollback()
        return False
    finally:
        db.close()


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    seed_gaokao_data()
