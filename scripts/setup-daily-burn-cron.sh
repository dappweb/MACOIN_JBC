#!/bin/bash
# 每日燃烧定时任务设置脚本

PROJECT_DIR="/home/zyj_dev/Documents/MACOIN_JBC-p-prod"
SCRIPT_PATH="$PROJECT_DIR/scripts/daily-burn-cron.cjs"
LOG_FILE="/var/log/daily-burn.log"

echo "🔥 设置每日燃烧定时任务"
echo "========================================"

# 检查脚本是否存在
if [ ! -f "$SCRIPT_PATH" ]; then
    echo "❌ 错误: 脚本不存在: $SCRIPT_PATH"
    exit 1
fi

# 创建日志文件
sudo touch "$LOG_FILE" 2>/dev/null || LOG_FILE="$PROJECT_DIR/logs/daily-burn.log"
mkdir -p "$(dirname $LOG_FILE)"
touch "$LOG_FILE"

echo "项目目录: $PROJECT_DIR"
echo "脚本路径: $SCRIPT_PATH"
echo "日志文件: $LOG_FILE"

# 生成 cron 表达式
# 每天北京时间 10:00 (UTC+8) 执行 = UTC 02:00
CRON_ENTRY="0 2 * * * cd $PROJECT_DIR && /usr/bin/node $SCRIPT_PATH >> $LOG_FILE 2>&1"

echo ""
echo "📋 Cron 任务配置:"
echo "   $CRON_ENTRY"
echo ""

# 检查是否已存在
EXISTING=$(crontab -l 2>/dev/null | grep "daily-burn-cron.cjs")
if [ -n "$EXISTING" ]; then
    echo "⚠️  已存在相同任务，是否覆盖? (y/n)"
    read -r CONFIRM
    if [ "$CONFIRM" != "y" ]; then
        echo "取消设置"
        exit 0
    fi
    # 移除旧任务
    crontab -l 2>/dev/null | grep -v "daily-burn-cron.cjs" | crontab -
fi

# 添加新任务
(crontab -l 2>/dev/null; echo "$CRON_ENTRY") | crontab -

echo "✅ Cron 任务已添加"
echo ""
echo "📌 验证:"
crontab -l | grep "daily-burn"
echo ""
echo "🔍 查看日志: tail -f $LOG_FILE"
echo ""
echo "⏰ 执行时间: 每天 UTC 02:00 (北京时间 10:00)"
echo ""
echo "💡 手动测试: node $SCRIPT_PATH"

