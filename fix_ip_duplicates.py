#!/usr/bin/env python3
"""
修复数据库中的IP重复问题
将所有已释放的IP记录的ip_address字段改为 released_xxx 格式，释放unique约束
"""
import sqlite3
from datetime import datetime

DB_PATH = "haik8s/backend/db/haik8s.db"

def fix_released_ips():
    """修复已释放的IP记录"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # 查找所有已释放的IP（is_active=0）
        cursor.execute("""
            SELECT id, user_id, ip_address, is_active, released_at
            FROM ip_allocations
            WHERE is_active = 0
        """)

        released_records = cursor.fetchall()

        if not released_records:
            print("✓ 没有需要修复的已释放IP记录")
            return

        print(f"找到 {len(released_records)} 条已释放的IP记录，开始修复...")

        # 更新每条已释放的记录
        for record in released_records:
            record_id, user_id, old_ip, is_active, released_at = record

            # 生成新的IP地址格式: released_{user_id}_{timestamp}
            timestamp = datetime.now().timestamp()
            new_ip = f"released_{user_id}_{timestamp}"

            cursor.execute("""
                UPDATE ip_allocations
                SET ip_address = ?
                WHERE id = ?
            """, (new_ip, record_id))

            print(f"  - 记录ID {record_id}: {old_ip} -> {new_ip}")

        # 提交更改
        conn.commit()
        print(f"\n✓ 成功修复 {len(released_records)} 条记录")

        # 显示当前所有活跃的IP
        cursor.execute("""
            SELECT user_id, ip_address, allocated_at
            FROM ip_allocations
            WHERE is_active = 1
            ORDER BY ip_address
        """)

        active_ips = cursor.fetchall()
        if active_ips:
            print(f"\n当前活跃的IP分配 ({len(active_ips)} 个):")
            for user_id, ip_address, allocated_at in active_ips:
                print(f"  - 用户 {user_id}: {ip_address} (分配时间: {allocated_at})")
        else:
            print("\n当前没有活跃的IP分配")

    except Exception as e:
        print(f"✗ 修复失败: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    print("=" * 60)
    print("IP重复问题修复脚本")
    print("=" * 60)
    print(f"数据库路径: {DB_PATH}\n")

    fix_released_ips()

    print("\n" + "=" * 60)
    print("修复完成！请重启后端服务以应用更改。")
    print("=" * 60)
