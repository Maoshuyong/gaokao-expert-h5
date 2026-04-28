"""
初始化示例数据
"""
import sys
sys.path.insert(0, '.')

from db import SessionLocal, init_db
from models import College, Score


def init_sample_data():
    """初始化示例数据"""
    db = SessionLocal()

    # 清空现有数据
    db.query(Score).delete()
    db.query(College).delete()

    # 插入示例院校
    colleges = [
        College(
            code="10001",
            name="北京大学",
            short_name="北大",
            province="北京",
            city="北京市",
            level="本科",
            type="综合",
            is_985=True,
            is_211=True,
            is_double_first=True,
            ranking=1,
            has_master=True,
            has_doctor=True,
            avg_tuition=5000,
            description="中国最顶尖的综合性大学"
        ),
        College(
            code="10002",
            name="清华大学",
            short_name="清华",
            province="北京",
            city="北京市",
            level="本科",
            type="理工",
            is_985=True,
            is_211=True,
            is_double_first=True,
            ranking=2,
            has_master=True,
            has_doctor=True,
            avg_tuition=5000,
            description="中国最顶尖的理工科大学"
        ),
        College(
            code="31001",
            name="复旦大学",
            short_name="复旦",
            province="上海",
            city="上海市",
            level="本科",
            type="综合",
            is_985=True,
            is_211=True,
            is_double_first=True,
            ranking=4,
            has_master=True,
            has_doctor=True,
            avg_tuition=6000,
            description="上海顶尖综合性大学"
        ),
        College(
            code="31002",
            name="上海交通大学",
            short_name="上交",
            province="上海",
            city="上海市",
            level="本科",
            type="综合",
            is_985=True,
            is_211=True,
            is_double_first=True,
            ranking=3,
            has_master=True,
            has_doctor=True,
            avg_tuition=6000,
            description="工科强校"
        ),
        College(
            code="50001",
            name="四川大学",
            short_name="川大",
            province="四川",
            city="成都市",
            level="本科",
            type="综合",
            is_985=True,
            is_211=True,
            is_double_first=True,
            ranking=11,
            has_master=True,
            has_doctor=True,
            avg_tuition=6000,
            description="西南地区顶尖综合性大学"
        ),
        College(
            code="50002",
            name="电子科技大学",
            short_name="成电",
            province="四川",
            city="成都市",
            level="本科",
            type="理工",
            is_985=True,
            is_211=True,
            is_double_first=True,
            ranking=29,
            has_master=True,
            has_doctor=True,
            avg_tuition=6000,
            description="电子信息类顶尖高校"
        ),
        College(
            code="32001",
            name="南京大学",
            short_name="南大",
            province="江苏",
            city="南京市",
            level="本科",
            type="综合",
            is_985=True,
            is_211=True,
            is_double_first=True,
            ranking=5,
            has_master=True,
            has_doctor=True,
            avg_tuition=6000,
            description="江苏顶尖综合性大学"
        ),
        College(
            code="33001",
            name="浙江大学",
            short_name="浙大",
            province="浙江",
            city="杭州市",
            level="本科",
            type="综合",
            is_985=True,
            is_211=True,
            is_double_first=True,
            ranking=3,
            has_master=True,
            has_doctor=True,
            avg_tuition=6000,
            description="浙江顶尖综合性大学"
        ),
        College(
            code="44001",
            name="中山大学",
            short_name="中大",
            province="广东",
            city="广州市",
            level="本科",
            type="综合",
            is_985=True,
            is_211=True,
            is_double_first=True,
            ranking=10,
            has_master=True,
            has_doctor=True,
            avg_tuition=6000,
            description="华南顶尖综合性大学"
        ),
        College(
            code="44002",
            name="华南理工大学",
            short_name="华工",
            province="广东",
            city="广州市",
            level="本科",
            type="理工",
            is_985=True,
            is_211=True,
            is_double_first=True,
            ranking=24,
            has_master=True,
            has_doctor=True,
            avg_tuition=6000,
            description="华南理工强校"
        ),
    ]

    for college in colleges:
        db.add(college)

    db.commit()
    print(f"已插入 {len(colleges)} 所院校")

    # 插入示例录取数据
    score_data = [
        # 北京大学 - 四川理科
        Score(college_code="10001", college_name="北京大学", province="四川", year=2025, category="理科", min_score=695, min_rank=50, avg_score=702, control_score=539),
        Score(college_code="10001", college_name="北京大学", province="四川", year=2024, category="理科", min_score=693, min_rank=45, avg_score=700, control_score=539),
        Score(college_code="10001", college_name="北京大学", province="四川", year=2023, category="理科", min_score=691, min_rank=48, avg_score=698, control_score=520),

        # 清华大学 - 四川理科
        Score(college_code="10002", college_name="清华大学", province="四川", year=2025, category="理科", min_score=693, min_rank=60, avg_score=698, control_score=539),
        Score(college_code="10002", college_name="清华大学", province="四川", year=2024, category="理科", min_score=691, min_rank=55, avg_score=696, control_score=539),
        Score(college_code="10002", college_name="清华大学", province="四川", year=2023, category="理科", min_score=689, min_rank=52, avg_score=694, control_score=520),

        # 复旦大学 - 四川理科
        Score(college_code="31001", college_name="复旦大学", province="四川", year=2025, category="理科", min_score=675, min_rank=300, avg_score=682, control_score=539),
        Score(college_code="31001", college_name="复旦大学", province="四川", year=2024, category="理科", min_score=672, min_rank=320, avg_score=679, control_score=539),
        Score(college_code="31001", college_name="复旦大学", province="四川", year=2023, category="理科", min_score=668, min_rank=280, avg_score=675, control_score=520),

        # 四川大学 - 四川理科
        Score(college_code="50001", college_name="四川大学", province="四川", year=2025, category="理科", min_score=598, min_rank=25000, avg_score=618, control_score=539),
        Score(college_code="50001", college_name="四川大学", province="四川", year=2024, category="理科", min_score=595, min_rank=26000, avg_score=615, control_score=539),
        Score(college_code="50001", college_name="四川大学", province="四川", year=2023, category="理科", min_score=607, min_rank=22000, avg_score=627, control_score=520),

        # 电子科技大学 - 四川理科
        Score(college_code="50002", college_name="电子科技大学", province="四川", year=2025, category="理科", min_score=635, min_rank=10000, avg_score=648, control_score=539),
        Score(college_code="50002", college_name="电子科技大学", province="四川", year=2024, category="理科", min_score=638, min_rank=9500, avg_score=651, control_score=539),
        Score(college_code="50002", college_name="电子科技大学", province="四川", year=2023, category="理科", min_score=652, min_rank=8000, avg_score=665, control_score=520),

        # 北京大学 - 北京文科
        Score(college_code="10001", college_name="北京大学", province="北京", year=2025, category="文科", min_score=668, min_rank=80, avg_score=675, control_score=483),
        Score(college_code="10001", college_name="北京大学", province="北京", year=2024, category="文科", min_score=665, min_rank=75, avg_score=672, control_score=483),
    ]

    for score in score_data:
        db.add(score)

    db.commit()
    print(f"已插入 {len(score_data)} 条录取数据")

    db.close()
    print("示例数据初始化完成！")


if __name__ == "__main__":
    init_db()
    init_sample_data()
