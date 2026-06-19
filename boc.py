import os
import requests
from bs4 import BeautifulSoup
import json
import time
import pytz
from datetime import datetime

def countdown(t):
    while t:
        mins, secs = divmod(t, 60)
        timeformat = 'Next Packet: {:02d}:{:02d}'.format(mins, secs)
        print(timeformat, end='\r')
        time.sleep(1)
        t -= 1

def loop():
    def tg_send(msg):
        token = os.environ.get("TG_BOT_TOKEN")
        chat_id = os.environ.get("TG_CHAT_ID")
        if not token or not chat_id:
            raise RuntimeError("请设置环境变量 TG_BOT_TOKEN 和 TG_CHAT_ID")
        requests.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            data={"chat_id": chat_id, "text": msg},
        )

    data = {}
    r = requests.get('https://www.boc.cn/sourcedb/whpj/mfx_1620.html', verify=False,
                     headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.61'})
    r.encoding = r.apparent_encoding
    soup = BeautifulSoup(r.text, "lxml")

    table = soup.body.find("table", cellspacing='0')
    for row in table.find_all('tr'):
        columns = row.find_all('td')
        try:
            data[columns[0].get_text()] = {
                'buy': float(columns[1].get_text()),
                'sale': float(columns[2].get_text())
            }
        except:
            pass

    print(data)

    # 获取当前时间
    def get_current_time():
        # 设置时区
        cst_tz = pytz.timezone('Asia/Shanghai')  # CST（中国标准时间）
        aest_tz = pytz.timezone('Australia/Sydney')  # AEST（澳大利亚东部时间）

        # 获取当前时间
        cst_time = datetime.now(cst_tz).strftime('%Y-%m-%d %H:%M')
        aest_time = datetime.now(aest_tz).strftime('%Y-%m-%d %H:%M')

        return cst_time, aest_time

    cst_time, aest_time = get_current_time()

    try:
        last_data = json.loads(open("exchange_rate_monitor.json").read())
        diff = last_data['澳大利亚元']['sale'] - data['澳大利亚元']['sale']
    except:
        diff = 0
        tg_send(
            f"当前AUD/CNY汇率:\n买入: {data['澳大利亚元']['buy']}\n卖出: {data['澳大利亚元']['sale']}\n时间: {cst_time} (CST)\n          {aest_time} (AEST)"
        )
        open("exchange_rate_monitor.json", "w").write(json.dumps(data))
        
    if diff >= 1 or diff <= -1:
        msg = (
            f"------汇率变动通知------\n\n"
            f"当前AUD/CNY汇率:\n"
            f"买入: {data['澳大利亚元']['buy']}\n"
            f"卖出: {data['澳大利亚元']['sale']}\n"
            f"变动幅度: {diff:.2f} \n\n"
            f"当前USD/CNY汇率:\n"
            f"买入: {data['美元']['buy']}\n"
            f"卖出: {data['美元']['sale']}\n\n"        
            f"时间: {cst_time} (CST)\n          {aest_time} (AEST)"
        )
        tg_send(msg)
        open("exchange_rate_monitor.json", "w").write(json.dumps(data))
        
while True:          
    loop()
#    countdown(300)
    quit()
