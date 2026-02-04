-- 更新中文公告
INSERT INTO announcements (language, content, updated_at) 
VALUES ('zh', '关于节点ZH关于金宝RWA流动性挖矿端口开放的公告

尊敬的金宝RWA用户:

为保障平台长期稳定运营,我们将继续实施流动性挖矿进场频率限制。流动性挖矿端口开放时间将调整为每日13:30 (UTC+8),开启时长约为 1-5分钟。

请您提前做好准备,以免错过参与时机。

感谢您的理解与支持!

金宝RWA运营团队
2026/1/26', 1737892496000)
ON CONFLICT(language) DO UPDATE SET 
  content = '关于节点ZH关于金宝RWA流动性挖矿端口开放的公告

尊敬的金宝RWA用户:

为保障平台长期稳定运营,我们将继续实施流动性挖矿进场频率限制。流动性挖矿端口开放时间将调整为每日13:30 (UTC+8),开启时长约为 1-5分钟。

请您提前做好准备,以免错过参与时机。

感谢您的理解与支持!

金宝RWA运营团队
2026/1/26', 
  updated_at = 1737892496000;

-- 更新英文公告
INSERT INTO announcements (language, content, updated_at) 
VALUES ('en', 'Node ZH Announcement: Opening of JinBao RWA Liquidity Mining Port

Dear JinBao RWA Users,

To ensure the long-term stable operation of the platform, we will continue to implement frequency restrictions for liquidity mining participation. The liquidity mining port will be open daily at 13:30 (UTC+8) for a duration of approximately 1-5 minutes.

Please prepare in advance to avoid missing the opportunity to participate.

Thank you for your understanding and support!

The JinBao RWA Team
2026/1/26', 1737892496000)
ON CONFLICT(language) DO UPDATE SET 
  content = 'Node ZH Announcement: Opening of JinBao RWA Liquidity Mining Port

Dear JinBao RWA Users,

To ensure the long-term stable operation of the platform, we will continue to implement frequency restrictions for liquidity mining participation. The liquidity mining port will be open daily at 13:30 (UTC+8) for a duration of approximately 1-5 minutes.

Please prepare in advance to avoid missing the opportunity to participate.

Thank you for your understanding and support!

The JinBao RWA Team
2026/1/26', 
  updated_at = 1737892496000;
