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

        # 导入院校
        colleges = data.get('colleges', [])
        for c_data in colleges:
            college = College(**{k: v for k, v in c_data.items() if hasattr(College, k)})
            db.add(college)
        logger.info(f"导入 {len(colleges)} 所院校")

        # 批量提交
        db.commit()

        # 导入录取分数线
        scores = data.get('scores', [])
        for s_data in scores:
            score = Score(**{k: v for k, v in s_data.items() if hasattr(Score, k)})
            db.add(score)
        logger.info(f"导入 {len(scores)} 条录取记录")

        db.commit()
        logger.info("高考数据导入完成")
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
