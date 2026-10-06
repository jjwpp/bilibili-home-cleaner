// ==UserScript==
// @name         B站首页过滤
// @namespace    bilibili-home-cleaner
// @version      2.0.0
// @description  B站首页频道过滤器，按 B站频道分类控制首页推荐流显示内容
// @author       Codex
// @match        https://www.bilibili.com/
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const DEBUG = false;

    const CHANNEL_GROUPS = [
        {
            title: '第一组',
            items: [
                ['bangumi', '番剧', '📺'],
                ['movie', '电影', '🎬'],
                ['guochuang', '国创', '🐉'],
                ['tv', '电视剧', '📺'],
                ['variety', '综艺', '🎤'],
                ['documentary', '纪录片', '🎞️'],
                ['animation', '动画', '✨'],
                ['game', '游戏', '🎮'],
                ['kichiku', '鬼畜', '🌀'],
                ['music', '音乐', '🎵']
            ]
        },
        {
            title: '第二组',
            items: [
                ['dance', '舞蹈', '💃'],
                ['film', '影视', '🎥'],
                ['entertainment', '娱乐', '🎭'],
                ['knowledge', '知识', '📚'],
                ['technology', '科技数码', '💻'],
                ['information', '资讯', '📰'],
                ['food', '美食', '🍜'],
                ['theater', '小剧场', '🎟️'],
                ['car', '汽车', '🚗'],
                ['fashion', '时尚美妆', '💄']
            ]
        },
        {
            title: '第三组',
            items: [
                ['sports', '体育运动', '🏀'],
                ['animal', '动物', '🐾'],
                ['vlog', 'vlog', '📹'],
                ['life', '生活', '🏠'],
                ['drawing', '绘画', '🎨'],
                ['home', '家装房产', '🛋️'],
                ['outdoor', '户外', '⛺'],
                ['fitness', '健身', '💪'],
                ['handcraft', '手工', '🧵'],
                ['travel', '旅游出行', '🧳']
            ]
        },
        {
            title: '第四组',
            items: [
                ['agriculture', '三农', '🌾'],
                ['parentChild', '亲子', '👪'],
                ['health', '健康', '🩺'],
                ['emotion', '情感', '💬'],
                ['lifeInterest', '生活兴趣', '🌱'],
                ['lifeExperience', '生活经验', '💡'],
                ['publicWelfare', '公益', '🤝'],
                ['ultraHD', '超高清', '🖥️'],
                ['videoPodcast', '视频播客', '🎙️']
            ]
        },
        {
            title: '第五组',
            items: [
                ['comic', '漫画', '📖'],
                ['article', '专栏', '📝'],
                ['live', '直播', '🔴'],
                ['activity', '活动', '🎉'],
                ['classroom', '课堂', '🎓'],
                ['community', '社区中心', '🏛️'],
                ['musicChart', '新歌热榜', '🔥']
            ]
        }
    ];

    const DEFAULT_CHANNEL_CONFIG = Object.fromEntries(
        CHANNEL_GROUPS.flatMap((group) => group.items).map(([key]) => [key, true])
    );

    const DEFAULT_SPECIAL_CONFIG = {
        event: false,
        ad: false,
        goods: false,
        topic: false,
        special: false,
        unknown: true
    };

    const CONFIG = {
        channels: { ...DEFAULT_CHANNEL_CONFIG },
        special: { ...DEFAULT_SPECIAL_CONFIG },
        debug: DEBUG
    };

    const SCRIPT_ID = 'bili-home-normal-video-cleaner-style';
    const PANEL_ID = 'bili-clean-filter-panel';
    const TOGGLE_ID = 'bili-clean-filter-toggle';
    const STORAGE_KEY = 'BiliHomeChannelFilterConfigV2';
    const CARD_DONE_ATTR = 'data-bili-cleaned';
    const CARD_TYPE_ATTR = 'data-bili-clean-type';
    const CARD_CHANNEL_ATTR = 'data-bili-clean-channel';
    const HIDDEN_CLASS = 'bili-clean-hidden-card';

    let processedCards = new WeakSet();
    const pendingRoots = new Set();
    let observer = null;
    let flushTimer = 0;
    let routeTimer = 0;
    let lastUrl = location.href;

    const CARD_SELECTOR = [
        '.feed-card',
        '.bili-feed-card',
        '.bili-video-card',
        '.floor-single-card',
        '.rcmd-card',
        '.recommend-card',
        '.video-card',
        '[class*="feed-card"]',
        '[class*="bili-video-card"]'
    ].join(',');

    const CARD_ROOT_SELECTOR = [
        '.feed-card',
        '.bili-feed-card',
        '.floor-single-card',
        '.rcmd-card',
        '.recommend-card'
    ].join(',');

    const VIDEO_URL_RE = /^\/video\/(?:BV[\w]+|av\d+)/i;
    const LIVE_HOST_RE = /(^|\.)live\.bilibili\.com$/i;

    const CHANNEL_LABELS = Object.fromEntries(
        CHANNEL_GROUPS.flatMap((group) => group.items).map(([key, label]) => [key, label])
    );

    const CHANNEL_TOTAL = Object.keys(DEFAULT_CHANNEL_CONFIG).length;

    const CHANNEL_RULES = [
        ['bangumi', ['番剧', '追番', 'bangumi', 'pgc']],
        ['movie', ['电影', 'movie', 'cinema']],
        ['guochuang', ['国创', 'guochuang']],
        ['tv', ['电视剧', 'teleplay']],
        ['variety', ['综艺', 'variety']],
        ['documentary', ['纪录片', 'documentary']],
        ['animation', ['动画', 'anime', 'animation']],
        ['comic', ['漫画', 'manga', 'comic']],
        ['game', ['游戏', '单机游戏', '网络游戏', '手机游戏', '电子竞技', 'game']],
        ['kichiku', ['鬼畜', 'kichiku']],
        ['music', ['音乐', 'music']],
        ['dance', ['舞蹈', 'dance']],
        ['film', ['影视', '影视剪辑', 'film']],
        ['entertainment', ['娱乐', 'entertainment']],
        ['knowledge', ['知识', '学习', '科普', 'knowledge']],
        ['technology', ['科技', '数码', '科技数码', 'digital', 'technology', 'tech']],
        ['information', ['资讯', '新闻', 'information', 'news']],
        ['food', ['美食', 'food']],
        ['theater', ['小剧场', 'theater']],
        ['car', ['汽车', 'car', 'automotive']],
        ['fashion', ['时尚', '美妆', '时尚美妆', 'fashion']],
        ['sports', ['体育', '运动', '体育运动', 'sports']],
        ['animal', ['动物', 'animal']],
        ['vlog', ['vlog']],
        ['life', ['生活', 'life']],
        ['drawing', ['绘画', '画画', 'drawing', 'paint']],
        ['home', ['家装', '房产', '家装房产', 'home']],
        ['outdoor', ['户外', 'outdoor']],
        ['fitness', ['健身', 'fitness']],
        ['handcraft', ['手工', 'handcraft']],
        ['travel', ['旅游', '出行', '旅游出行', 'travel']],
        ['agriculture', ['三农', '农业', 'agriculture']],
        ['parentChild', ['亲子', 'parent']],
        ['health', ['健康', 'health']],
        ['emotion', ['情感', 'emotion']],
        ['lifeInterest', ['生活兴趣']],
        ['lifeExperience', ['生活经验']],
        ['publicWelfare', ['公益', 'public welfare']],
        ['ultraHD', ['超高清', '4k', '8k', 'uhd']],
        ['videoPodcast', ['视频播客', '播客', 'podcast']],
        ['article', ['专栏', '文章', 'article', 'read']],
        ['live', ['直播', 'live']],
        ['activity', ['活动', 'activity']],
        ['classroom', ['课堂', '课程', 'classroom', 'cheese']],
        ['community', ['社区中心', 'community']],
        ['musicChart', ['新歌热榜', '热歌', 'music chart']]
    ];

    function log(...args) {
        if (CONFIG.debug) {
            console.log('[BiliClean]', ...args);
        }
    }

    function isHomePage() {
        return location.hostname === 'www.bilibili.com' && (location.pathname === '/' || location.pathname === '');
    }

    function installStyle() {
        if (document.getElementById(SCRIPT_ID)) return;
        const style = document.createElement('style');
        style.id = SCRIPT_ID;
        style.textContent = `
            .${HIDDEN_CLASS} {
                display: none !important;
            }
            #${TOGGLE_ID} {
                position: fixed;
                right: 18px;
                bottom: 88px;
                z-index: 2147483646;
                width: 44px;
                height: 44px;
                border: 0;
                border-radius: 50%;
                background: #00aeec;
                color: #fff;
                box-shadow: 0 6px 18px rgba(0, 0, 0, .18);
                cursor: pointer;
                font-size: 20px;
                line-height: 44px;
                text-align: center;
            }
            #${PANEL_ID} {
                position: fixed;
                right: 18px;
                bottom: 142px;
                z-index: 2147483646;
                width: min(760px, calc(100vw - 36px));
                max-height: min(720px, calc(100vh - 170px));
                overflow: hidden;
                display: none;
                color: #18191c;
                background: #fff;
                border: 1px solid rgba(0, 0, 0, .08);
                border-radius: 10px;
                box-shadow: 0 16px 48px rgba(0, 0, 0, .22);
                font: 14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
            }
            #${PANEL_ID}.is-open {
                display: flex;
                flex-direction: column;
            }
            #${PANEL_ID} .bc-head {
                padding: 16px 18px 12px;
                border-bottom: 1px solid #f1f2f3;
            }
            #${PANEL_ID} .bc-title {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 12px;
                font-weight: 700;
                font-size: 16px;
            }
            #${PANEL_ID} .bc-subtitle {
                margin-top: 4px;
                color: #61666d;
                font-size: 12px;
            }
            #${PANEL_ID} .bc-close {
                border: 0;
                background: transparent;
                color: #61666d;
                cursor: pointer;
                font-size: 18px;
                width: 28px;
                height: 28px;
            }
            #${PANEL_ID} .bc-search {
                margin-top: 12px;
                width: 100%;
                height: 34px;
                box-sizing: border-box;
                border: 1px solid #e3e5e7;
                border-radius: 6px;
                padding: 0 10px;
                outline: none;
            }
            #${PANEL_ID} .bc-search:focus {
                border-color: #00aeec;
            }
            #${PANEL_ID} .bc-body {
                padding: 14px 18px;
                overflow: auto;
            }
            #${PANEL_ID} .bc-grid {
                display: grid;
                grid-template-columns: repeat(5, minmax(112px, 1fr));
                gap: 12px 14px;
            }
            #${PANEL_ID} .bc-group {
                min-width: 0;
            }
            #${PANEL_ID} .bc-item {
                display: flex;
                align-items: center;
                gap: 7px;
                min-height: 30px;
                padding: 4px 6px;
                border-radius: 6px;
                cursor: pointer;
                user-select: none;
                white-space: nowrap;
            }
            #${PANEL_ID} .bc-item:hover {
                background: #f6f7f8;
            }
            #${PANEL_ID} .bc-item input {
                margin: 0;
                accent-color: #00aeec;
            }
            #${PANEL_ID} .bc-icon {
                width: 18px;
                text-align: center;
                flex: 0 0 auto;
            }
            #${PANEL_ID} .bc-label {
                overflow: hidden;
                text-overflow: ellipsis;
            }
            #${PANEL_ID} .bc-foot {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 10px;
                padding: 12px 18px 16px;
                border-top: 1px solid #f1f2f3;
            }
            #${PANEL_ID} .bc-actions {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
            }
            #${PANEL_ID} .bc-btn {
                height: 32px;
                border: 1px solid #e3e5e7;
                border-radius: 6px;
                background: #fff;
                color: #18191c;
                cursor: pointer;
                padding: 0 11px;
            }
            #${PANEL_ID} .bc-btn:hover {
                border-color: #00aeec;
                color: #00aeec;
            }
            #${PANEL_ID} .bc-apply {
                border-color: #00aeec;
                background: #00aeec;
                color: #fff;
            }
            #${PANEL_ID} .bc-apply:hover {
                color: #fff;
                background: #009bd8;
            }
            @media (max-width: 720px) {
                #${PANEL_ID} .bc-grid {
                    grid-template-columns: repeat(2, minmax(120px, 1fr));
                }
            }
        `;
        (document.head || document.documentElement).appendChild(style);
    }

    function loadSavedConfig() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const saved = JSON.parse(raw);
            const savedChannels = saved.channels || {};
            const savedKeys = Object.keys(savedChannels).filter((key) => key in DEFAULT_CHANNEL_CONFIG);
            const hasPartialSavedConfig = savedKeys.length > 0 && savedKeys.some((key) => savedChannels[key] === false);
            const baseChannels = {};
            for (const key of Object.keys(DEFAULT_CHANNEL_CONFIG)) {
                baseChannels[key] = Object.prototype.hasOwnProperty.call(savedChannels, key)
                    ? savedChannels[key]
                    : !hasPartialSavedConfig;
            }
            CONFIG.channels = baseChannels;
            CONFIG.special = { ...DEFAULT_SPECIAL_CONFIG, ...(saved.special || {}) };
            if (typeof saved.debug === 'boolean') CONFIG.debug = saved.debug;
        } catch (error) {
            log('读取配置失败，使用默认配置', error);
        }
    }

    function saveConfig() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            channels: CONFIG.channels,
            special: CONFIG.special,
            debug: CONFIG.debug
        }));
    }

    function getEnabledCount() {
        return Object.values(CONFIG.channels).filter(Boolean).length;
    }

    function resetProcessedAndRescan() {
        processedCards = new WeakSet();
        initialScan();
    }

    function createButton(tag, className, text) {
        const button = document.createElement(tag);
        button.className = className;
        button.textContent = text;
        return button;
    }

    function renderPanelCounts(panel) {
        const count = panel.querySelector('[data-role="count"]');
        if (count) count.textContent = `已启用 ${getEnabledCount()} / ${CHANNEL_TOTAL} 个分类`;
    }

    function syncPanelChecks(panel) {
        for (const input of panel.querySelectorAll('input[data-channel]')) {
            input.checked = CONFIG.channels[input.dataset.channel] !== false;
        }
        renderPanelCounts(panel);
    }

    function applySearch(panel, keyword) {
        const value = keyword.trim().toLowerCase();
        for (const item of panel.querySelectorAll('.bc-item')) {
            const text = item.dataset.search || '';
            item.style.display = !value || text.includes(value) ? '' : 'none';
        }
    }

    function createPanel() {
        if (document.getElementById(PANEL_ID)) return;

        const toggle = createButton('button', '', '⚙');
        toggle.id = TOGGLE_ID;
        toggle.type = 'button';
        toggle.title = 'B站首页内容过滤';

        const panel = document.createElement('section');
        panel.id = PANEL_ID;
        panel.innerHTML = `
            <div class="bc-head">
                <div class="bc-title">
                    <span>⚙ B站首页内容过滤</span>
                    <button class="bc-close" type="button" title="关闭">×</button>
                </div>
                <div class="bc-subtitle"><span data-role="count"></span>，控制首页推荐流显示哪些频道</div>
                <input class="bc-search" type="search" placeholder="搜索分类，例如：游戏、生活、科技" autocomplete="off">
            </div>
            <div class="bc-body">
                <div class="bc-grid"></div>
            </div>
            <div class="bc-foot">
                <div class="bc-actions">
                    <button class="bc-btn" type="button" data-action="all-on">全部开启</button>
                    <button class="bc-btn" type="button" data-action="all-off">全部关闭</button>
                    <button class="bc-btn" type="button" data-action="reset">恢复默认</button>
                </div>
                <button class="bc-btn bc-apply" type="button" data-action="apply">立即应用</button>
            </div>
        `;

        const grid = panel.querySelector('.bc-grid');
        for (const group of CHANNEL_GROUPS) {
            const column = document.createElement('div');
            column.className = 'bc-group';
            for (const [key, label, icon] of group.items) {
                const item = document.createElement('label');
                item.className = 'bc-item';
                item.dataset.search = `${key} ${label}`.toLowerCase();
                item.innerHTML = `
                    <input type="checkbox" data-channel="${key}">
                    <span class="bc-icon">${icon}</span>
                    <span class="bc-label">${label}</span>
                `;
                column.appendChild(item);
            }
            grid.appendChild(column);
        }

        panel.addEventListener('change', (event) => {
            const input = event.target;
            if (!(input instanceof HTMLInputElement) || !input.dataset.channel) return;
            CONFIG.channels[input.dataset.channel] = input.checked;
            saveConfig();
            renderPanelCounts(panel);
            resetProcessedAndRescan();
        });

        panel.addEventListener('click', (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;
            if (target.classList.contains('bc-close')) {
                panel.classList.remove('is-open');
                return;
            }
            const action = target.dataset.action;
            if (!action) return;
            if (action === 'all-on') {
                for (const key of Object.keys(CONFIG.channels)) CONFIG.channels[key] = true;
            } else if (action === 'all-off') {
                for (const key of Object.keys(CONFIG.channels)) CONFIG.channels[key] = false;
            } else if (action === 'reset') {
                CONFIG.channels = { ...DEFAULT_CHANNEL_CONFIG };
                CONFIG.special = { ...DEFAULT_SPECIAL_CONFIG };
            }
            saveConfig();
            syncPanelChecks(panel);
            resetProcessedAndRescan();
        });

        panel.querySelector('.bc-search').addEventListener('input', (event) => {
            applySearch(panel, event.target.value);
        });

        toggle.addEventListener('click', () => {
            panel.classList.toggle('is-open');
            syncPanelChecks(panel);
        });

        (document.body || document.documentElement).append(panel, toggle);
        syncPanelChecks(panel);
    }

    function toUrl(href) {
        if (!href) return null;
        try {
            return new URL(href, location.href);
        } catch (_) {
            return null;
        }
    }

    function getLinks(card) {
        return Array.from(card.querySelectorAll('a[href]'))
            .map((a) => ({ element: a, url: toUrl(a.getAttribute('href') || a.href) }))
            .filter((item) => item.url);
    }

    function getClassAndDataText(card) {
        const parts = [];
        const nodes = [card, ...Array.from(card.querySelectorAll('[class], [data-target-url], [data-url], [data-card-type], [data-type], [data-module], [data-report-click], [data-report]')).slice(0, 80)];
        for (const node of nodes) {
            if (node.className && typeof node.className === 'string') parts.push(node.className);
            for (const attr of Array.from(node.attributes || [])) {
                if (/^(data-|aria-label$|title$)/i.test(attr.name)) {
                    parts.push(`${attr.name}=${attr.value}`);
                }
            }
        }
        return parts.join(' ').toLowerCase();
    }

    function getBadgeText(card) {
        const badgeSelectors = [
            '[class*="badge"]',
            '[class*="tag"]',
            '[class*="label"]',
            '[class*="mark"]',
            '[class*="rcmd-reason"]',
            '[class*="corner"]',
            '[class*="desc"]',
            '.bili-video-card__info--date',
            '.bili-video-card__info--author'
        ].join(',');

        return Array.from(card.querySelectorAll(badgeSelectors))
            .slice(0, 40)
            .map((node) => (node.textContent || '').trim())
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
    }

    function getTitleText(card) {
        const titleNode = card.querySelector([
            '.bili-video-card__info--tit',
            '.bili-video-card__info--title',
            '[class*="title"]',
            'a[title]'
        ].join(','));
        return ((titleNode && (titleNode.getAttribute('title') || titleNode.textContent)) || '').trim();
    }

    function getChannelSignalText(card) {
        const selectors = [
            '[class*="channel"]',
            '[class*="partition"]',
            '[class*="category"]',
            '[class*="zone"]',
            '[class*="tag"]',
            '[class*="badge"]',
            '[class*="label"]',
            '[data-channel]',
            '[data-partition]',
            '[data-category]',
            '[data-tname]',
            '[data-rname]',
            '[data-tag]'
        ].join(',');
        const parts = [];
        for (const node of Array.from(card.querySelectorAll(selectors)).slice(0, 50)) {
            const text = (node.textContent || '').trim();
            if (text) parts.push(text);
            for (const attr of Array.from(node.attributes || [])) {
                if (/^(data-|aria-label$|title$)/i.test(attr.name) && attr.value) {
                    parts.push(attr.value);
                }
            }
        }
        return parts.join(' ').toLowerCase();
    }

    function textHasToken(text, token) {
        const lowerToken = token.toLowerCase();
        if (/^[a-z0-9 -]+$/i.test(token)) {
            return new RegExp(`(^|[^a-z0-9])${lowerToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'i').test(text);
        }
        return text.includes(lowerToken);
    }

    function detectChannelFromStructuredSignals(card) {
        const structuredText = [
            getClassAndDataText(card),
            getBadgeText(card),
            getChannelSignalText(card)
        ].join(' ');

        for (const [channel, tokens] of CHANNEL_RULES) {
            if (tokens.some((token) => textHasToken(structuredText, token))) {
                return { channel, reason: `DOM/标签/频道信息匹配「${CHANNEL_LABELS[channel]}」` };
            }
        }
        return null;
    }

    function detectChannelFromUrl(card) {
        const links = getLinks(card);
        for (const { url } of links) {
            const full = decodeURIComponent(`${url.hostname}${url.pathname}${url.search}`).toLowerCase();
            if (/live\.bilibili\.com/.test(full)) return { channel: 'live', reason: '直播 URL' };
            if (/\/bangumi\//.test(full)) return { channel: 'bangumi', reason: '番剧 URL' };
            if (/\/movie\//.test(full) || /\/cinema\//.test(full)) return { channel: 'movie', reason: '电影 URL' };
            if (/\/guochuang\//.test(full)) return { channel: 'guochuang', reason: '国创 URL' };
            if (/\/documentary\//.test(full)) return { channel: 'documentary', reason: '纪录片 URL' };
            if (/\/variety\//.test(full)) return { channel: 'variety', reason: '综艺 URL' };
            if (/\/tv\//.test(full) || /\/teleplay\//.test(full)) return { channel: 'tv', reason: '电视剧 URL' };
            if (/manga\.bilibili\.com/.test(full) || /\/manga\//.test(full) || /\/comic\//.test(full)) return { channel: 'comic', reason: '漫画 URL' };
            if (/\/read\//.test(full) || /\/opus\//.test(full) || /\/article\//.test(full)) return { channel: 'article', reason: '专栏/文章 URL' };
            if (/\/cheese\//.test(full) || /classroom/.test(full)) return { channel: 'classroom', reason: '课堂 URL' };
            if (/\/activity\//.test(full) || /\/blackboard\//.test(full)) return { channel: 'activity', reason: '活动 URL' };
            if (/music-chart|new-song|新歌热榜/.test(full)) return { channel: 'musicChart', reason: '新歌热榜 URL' };
        }
        return null;
    }

    function detectChannelByTitleFallback(card) {
        const title = getTitleText(card).toLowerCase();
        if (!title) return null;

        const conservativeRules = [
            ['vlog', /\bvlog\b/i],
            ['ultraHD', /(^|[^a-z0-9])(4k|8k|uhd)([^a-z0-9]|$)/i],
            ['videoPodcast', /播客|podcast/i]
        ];

        for (const [channel, pattern] of conservativeRules) {
            if (pattern.test(title)) {
                return { channel, reason: `标题兜底弱匹配「${CHANNEL_LABELS[channel]}」` };
            }
        }
        return null;
    }

    function detectChannel(card) {
        return detectChannelFromUrl(card) ||
            detectChannelFromStructuredSignals(card) ||
            detectChannelByTitleFallback(card);
    }

    function hasNormalVideoUrl(card) {
        return getLinks(card).some(({ url }) => {
            const isBili = /(^|\.)bilibili\.com$/i.test(url.hostname);
            return isBili && VIDEO_URL_RE.test(url.pathname);
        });
    }

    function hasVideoCardStructure(card) {
        return Boolean(
            card.matches('.bili-video-card, .feed-card, .bili-feed-card, [class*="bili-video-card"]') &&
            card.querySelector('a[href*="/video/"]') &&
            (
                card.querySelector('[class*="duration"]') ||
                card.querySelector('[class*="stats"]') ||
                card.querySelector('[class*="cover"]') ||
                card.querySelector('[class*="info"]')
            )
        );
    }

    function hasUrl(card, tests) {
        return getLinks(card).some(({ url }) => tests.some((test) => test(url)));
    }

    function hasClassOrData(card, patterns) {
        const text = getClassAndDataText(card);
        return patterns.some((pattern) => pattern.test(text));
    }

    function hasBadge(card, patterns) {
        const text = getBadgeText(card);
        return patterns.some((pattern) => pattern.test(text));
    }

    function isAdvertisementCard(card) {
        if (hasUrl(card, [
            (url) => /(^|\.)cm\.bilibili\.com$/i.test(url.hostname),
            (url) => /(^|\.)ad\./i.test(url.hostname),
            (url) => /\/ad\//i.test(url.pathname),
            (url) => /\/commercial\//i.test(url.pathname),
            (url) => /spm_id_from=.*ad/i.test(url.search)
        ])) return true;

        return hasClassOrData(card, [
            /\bad\b/,
            /\bads\b/,
            /adcard/,
            /advert/,
            /commercial/,
            /creative-id/,
            /cm-mark/,
            /source.*ad/
        ]) || hasBadge(card, [
            /^广告$/,
            /^推广$/,
            /商业推广/,
            /广告/
        ]);
    }

    function isLiveCard(card) {
        if (hasUrl(card, [
            (url) => LIVE_HOST_RE.test(url.hostname),
            (url) => /\/live\//i.test(url.pathname)
        ])) return true;

        return hasClassOrData(card, [
            /\blive\b/,
            /bili-live/,
            /living/,
            /直播间/,
            /直播中/
        ]) || hasBadge(card, [
            /^直播$/,
            /直播中/,
            /直播间/
        ]);
    }

    function isBangumiCard(card) {
        if (hasUrl(card, [
            (url) => /\/bangumi\//i.test(url.pathname),
            (url) => /\/anime\//i.test(url.pathname)
        ])) return true;

        return hasClassOrData(card, [
            /bangumi/,
            /pgc/,
            /番剧/,
            /追番/
        ]) || hasBadge(card, [
            /^番剧$/,
            /番剧/,
            /追番/
        ]);
    }

    function isGuochuangCard(card) {
        if (hasUrl(card, [
            (url) => /\/guochuang\//i.test(url.pathname)
        ])) return true;

        return hasClassOrData(card, [
            /guochuang/,
            /国创/
        ]) || hasBadge(card, [
            /^国创$/,
            /国创/
        ]);
    }

    function isDocumentaryCard(card) {
        if (hasUrl(card, [
            (url) => /\/documentary\//i.test(url.pathname)
        ])) return true;

        return hasClassOrData(card, [
            /documentary/,
            /纪录片/
        ]) || hasBadge(card, [
            /^纪录片$/
        ]);
    }

    function isMovieCard(card) {
        if (hasUrl(card, [
            (url) => /\/movie\//i.test(url.pathname),
            (url) => /\/cinema\//i.test(url.pathname)
        ])) return true;

        return hasClassOrData(card, [
            /movie/,
            /cinema/,
            /电影/
        ]) || hasBadge(card, [
            /^电影$/
        ]);
    }

    function isTvCard(card) {
        if (hasUrl(card, [
            (url) => /\/tv\//i.test(url.pathname),
            (url) => /\/teleplay\//i.test(url.pathname)
        ])) return true;

        return hasClassOrData(card, [
            /teleplay/,
            /电视剧/
        ]) || hasBadge(card, [
            /^电视剧$/
        ]);
    }

    function isVarietyCard(card) {
        if (hasUrl(card, [
            (url) => /\/variety\//i.test(url.pathname)
        ])) return true;

        return hasClassOrData(card, [
            /variety/,
            /综艺/
        ]) || hasBadge(card, [
            /^综艺$/
        ]);
    }

    function isComicCard(card) {
        if (hasUrl(card, [
            (url) => /(^|\.)manga\.bilibili\.com$/i.test(url.hostname),
            (url) => /\/manga\//i.test(url.pathname)
        ])) return true;

        return hasClassOrData(card, [
            /manga/,
            /comic/,
            /漫画/
        ]) || hasBadge(card, [
            /^漫画$/
        ]);
    }

    function isArticleCard(card) {
        if (hasUrl(card, [
            (url) => /^\/read\//i.test(url.pathname),
            (url) => /^\/opus\//i.test(url.pathname),
            (url) => /\/article\//i.test(url.pathname)
        ])) return true;

        return hasClassOrData(card, [
            /article/,
            /opus/,
            /read-card/,
            /专栏/
        ]) || hasBadge(card, [
            /^专栏$/,
            /^文章$/
        ]);
    }

    function isClassroomCard(card) {
        if (hasUrl(card, [
            (url) => /\/cheese\//i.test(url.pathname),
            (url) => /\/classroom\//i.test(url.pathname)
        ])) return true;

        return hasClassOrData(card, [
            /cheese/,
            /classroom/,
            /课堂/,
            /课程/
        ]) || hasBadge(card, [
            /^课堂$/,
            /^课程$/
        ]);
    }

    function isGoodsCard(card) {
        if (hasUrl(card, [
            (url) => /(^|\.)mall\.bilibili\.com$/i.test(url.hostname),
            (url) => /(^|\.)show\.bilibili\.com$/i.test(url.hostname),
            (url) => /\/mall\//i.test(url.pathname),
            (url) => /\/blackboard\/activity.*(?:mall|shop|goods|ticket)/i.test(url.pathname + url.search)
        ])) return true;

        return hasClassOrData(card, [
            /goods/,
            /shop/,
            /mall/,
            /commodity/,
            /商品/,
            /带货/,
            /购票/
        ]) || hasBadge(card, [
            /商品/,
            /购买/,
            /购票/
        ]);
    }

    function isActivityCard(card) {
        if (hasUrl(card, [
            (url) => /\/blackboard\//i.test(url.pathname),
            (url) => /\/activity\//i.test(url.pathname),
            (url) => /\/festival\//i.test(url.pathname)
        ])) return true;

        return hasClassOrData(card, [
            /activity/,
            /festival/,
            /活动/
        ]) || hasBadge(card, [
            /^活动$/,
            /活动/
        ]);
    }

    function isTopicCard(card) {
        if (hasUrl(card, [
            (url) => /\/v\/topic/i.test(url.pathname),
            (url) => /\/topic\//i.test(url.pathname),
            (url) => /t\.bilibili\.com/i.test(url.hostname)
        ])) return true;

        return hasClassOrData(card, [
            /topic/,
            /话题/
        ]) || hasBadge(card, [
            /^话题$/,
            /话题/
        ]);
    }

    function isEventCard(card) {
        if (hasUrl(card, [
            (url) => /(^|\.)esports\.bilibili\.com$/i.test(url.hostname),
            (url) => /\/esports\//i.test(url.pathname),
            (url) => /\/match\//i.test(url.pathname),
            (url) => /\/game\/match/i.test(url.pathname),
            (url) => /\/blackboard\/(?:activity|live).*?(?:match|kpl|lpl|赛事|电竞)/i.test(decodeURIComponent(url.pathname + url.search))
        ])) return true;

        return hasClassOrData(card, [
            /esports/,
            /\bmatch\b/,
            /game-match/,
            /赛事/,
            /电竞/,
            /\bkpl\b/,
            /\blpl\b/
        ]) || hasBadge(card, [
            /^赛事$/,
            /^电竞$/,
            /电竞赛事/,
            /体育赛事/,
            /\bKPL\b/i,
            /\bLPL\b/i
        ]);
    }

    function isAnimationSpecialCard(card) {
        if (hasUrl(card, [
            (url) => /\/anime\//i.test(url.pathname)
        ])) return true;

        return hasClassOrData(card, [
            /anime-card/,
            /animation-card/,
            /动画专区/
        ]) || hasBadge(card, [
            /^动画$/
        ]);
    }

    function isOtherSpecialCard(card) {
        if (hasUrl(card, [
            (url) => /\/festival\//i.test(url.pathname),
            (url) => /\/v\/channel\//i.test(url.pathname),
            (url) => /\/h5\//i.test(url.pathname)
        ])) return true;

        return hasClassOrData(card, [
            /special-card/,
            /banner-card/,
            /single-card/,
            /floor-card/,
            /channel-card/,
            /rank-card/,
            /popular-card/
        ]) || hasBadge(card, [
            /^预约$/,
            /^专题$/,
            /^排行榜$/
        ]);
    }

    function isNormalVideoCard(card) {
        if (!hasNormalVideoUrl(card)) return false;

        const hasHardSpecialSignal =
            isAdvertisementCard(card) ||
            isLiveCard(card) ||
            isBangumiCard(card) ||
            isGuochuangCard(card) ||
            isDocumentaryCard(card) ||
            isMovieCard(card) ||
            isTvCard(card) ||
            isVarietyCard(card) ||
            isComicCard(card) ||
            isArticleCard(card) ||
            isClassroomCard(card) ||
            isGoodsCard(card) ||
            isActivityCard(card) ||
            isTopicCard(card) ||
            isEventCard(card);

        return !hasHardSpecialSignal && hasVideoCardStructure(card);
    }

    function classifyCard(card) {
        const detected = detectChannel(card);

        if (isAdvertisementCard(card)) return { type: 'ad', channel: null, reason: '广告/商业推广标识或链接' };
        if (isLiveCard(card)) return { type: 'live', channel: 'live', reason: '直播链接或直播专属标识' };
        if (isEventCard(card)) return { type: 'event', channel: detected?.channel || 'sports', reason: '赛事/电竞链接或角标' };
        if (isBangumiCard(card)) return { type: 'bangumi', channel: 'bangumi', reason: '番剧/PGC 链接或标识' };
        if (isGuochuangCard(card)) return { type: 'guochuang', channel: 'guochuang', reason: '国创链接或标识' };
        if (isDocumentaryCard(card)) return { type: 'documentary', channel: 'documentary', reason: '纪录片链接或标识' };
        if (isMovieCard(card)) return { type: 'movie', channel: 'movie', reason: '电影链接或标识' };
        if (isTvCard(card)) return { type: 'tv', channel: 'tv', reason: '电视剧链接或标识' };
        if (isVarietyCard(card)) return { type: 'variety', channel: 'variety', reason: '综艺链接或标识' };
        if (isComicCard(card)) return { type: 'comic', channel: 'comic', reason: '漫画链接或标识' };
        if (isArticleCard(card)) return { type: 'article', channel: 'article', reason: '专栏/文章/动态链接或标识' };
        if (isClassroomCard(card)) return { type: 'classroom', channel: 'classroom', reason: '课堂/课程链接或标识' };
        if (isGoodsCard(card)) return { type: 'goods', channel: null, reason: '商品/购票/商城链接或标识' };
        if (isActivityCard(card)) return { type: 'activity', channel: 'activity', reason: '活动页链接或标识' };
        if (isTopicCard(card)) return { type: 'topic', channel: null, reason: '话题链接或标识' };
        if (isAnimationSpecialCard(card)) return { type: 'animation', channel: 'animation', reason: '动画专题/PGC 标识' };
        if (isNormalVideoCard(card)) {
            return {
                type: 'normal-video',
                channel: detected?.channel || null,
                reason: detected ? detected.reason : '普通 BV/av 视频，但未识别到明确频道'
            };
        }
        if (detected) return { type: 'channel-card', channel: detected.channel, reason: detected.reason };
        if (isOtherSpecialCard(card)) return { type: 'special', channel: null, reason: '特殊推荐卡片结构或链接' };
        return { type: 'unknown', channel: null, reason: '无法确认，按保守策略保留' };
    }

    function shouldHide(classification) {
        if (classification.channel && CONFIG.channels[classification.channel] === false) return true;
        if (classification.type === 'unknown' || classification.type === 'normal-video' || classification.type === 'channel-card') return false;
        if (Object.prototype.hasOwnProperty.call(CONFIG.special, classification.type)) {
            return CONFIG.special[classification.type] === false;
        }
        return false;
    }

    function getCardRoot(node) {
        if (!node || node.nodeType !== Node.ELEMENT_NODE) return null;
        const element = node;
        return (
            element.closest('.feed-card') ||
            element.closest('.floor-single-card') ||
            element.closest('.rcmd-card') ||
            element.closest('.recommend-card') ||
            element.closest('.bili-feed-card') ||
            element.closest('.bili-video-card') ||
            element
        );
    }

    function markVisible(card, classification) {
        card.classList.remove(HIDDEN_CLASS);
        card.style.removeProperty('display');
        card.setAttribute(CARD_TYPE_ATTR, classification.type);
        if (classification.channel) {
            card.setAttribute(CARD_CHANNEL_ATTR, classification.channel);
        } else {
            card.removeAttribute(CARD_CHANNEL_ATTR);
        }
    }

    function hideCard(card, classification) {
        card.classList.add(HIDDEN_CLASS);
        card.style.setProperty('display', 'none', 'important');
        card.setAttribute(CARD_TYPE_ATTR, classification.type);
        if (classification.channel) {
            card.setAttribute(CARD_CHANNEL_ATTR, classification.channel);
        } else {
            card.removeAttribute(CARD_CHANNEL_ATTR);
        }
    }

    function processCard(candidate) {
        const card = getCardRoot(candidate);
        if (!card || processedCards.has(card)) return;
        if (!card.isConnected) return;
        if (!card.matches(CARD_SELECTOR) && !card.querySelector('a[href]')) return;

        processedCards.add(card);
        card.setAttribute(CARD_DONE_ATTR, 'true');

        const classification = classifyCard(card);
        const hide = shouldHide(classification);

        if (hide) {
            hideCard(card, classification);
            log('检测到卡片', card, '类型:', classification.type, '频道:', classification.channel || '无', '操作: 隐藏', '依据:', classification.reason);
        } else {
            markVisible(card, classification);
            log('检测到卡片', card, '类型:', classification.type, '频道:', classification.channel || '无', '操作: 保留', '依据:', classification.reason);
        }
    }

    function collectCards(root) {
        if (!root || root.nodeType !== Node.ELEMENT_NODE) return [];
        const element = root;
        const cards = [];
        if (element.matches(CARD_SELECTOR)) cards.push(element);
        cards.push(...Array.from(element.querySelectorAll(CARD_SELECTOR)));
        return Array.from(new Set(cards));
    }

    function scanRoot(root) {
        if (!isHomePage()) return;
        for (const card of collectCards(root)) {
            processCard(card);
        }
    }

    function scheduleScan(root) {
        if (!root || root.nodeType !== Node.ELEMENT_NODE) return;
        pendingRoots.add(root);
        if (flushTimer) return;
        flushTimer = window.requestAnimationFrame(() => {
            flushTimer = 0;
            const roots = Array.from(pendingRoots);
            pendingRoots.clear();
            for (const item of roots) scanRoot(item);
        });
    }

    function startObserver() {
        if (observer || !document.body) return;
        observer = new MutationObserver((records) => {
            if (!isHomePage()) return;
            for (const record of records) {
                if (record.type !== 'childList' || !record.addedNodes.length) continue;
                for (const node of record.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        scheduleScan(node);
                    }
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        log('MutationObserver 已启动');
    }

    function stopObserver() {
        if (!observer) return;
        observer.disconnect();
        observer = null;
        log('MutationObserver 已停止');
    }

    function initialScan() {
        if (!isHomePage()) {
            stopObserver();
            return;
        }
        installStyle();
        scanRoot(document.body || document.documentElement);
        startObserver();
    }

    function scheduleRouteCheck() {
        clearTimeout(routeTimer);
        routeTimer = window.setTimeout(() => {
            if (lastUrl === location.href) return;
            lastUrl = location.href;
            processedCards = new WeakSet();
            initialScan();
        }, 120);
    }

    function hookHistory() {
        const rawPushState = history.pushState;
        const rawReplaceState = history.replaceState;

        history.pushState = function (...args) {
            const result = rawPushState.apply(this, args);
            scheduleRouteCheck();
            return result;
        };

        history.replaceState = function (...args) {
            const result = rawReplaceState.apply(this, args);
            scheduleRouteCheck();
            return result;
        };

        window.addEventListener('popstate', scheduleRouteCheck, true);
    }

    function boot() {
        if (!isHomePage()) return;
        installStyle();
        if (document.body) {
            createPanel();
            initialScan();
        } else {
            document.addEventListener('DOMContentLoaded', () => {
                createPanel();
                initialScan();
            }, { once: true });
        }
        window.addEventListener('load', () => {
            createPanel();
            initialScan();
            window.setTimeout(initialScan, 800);
            window.setTimeout(initialScan, 2000);
        }, { once: true });
    }

    loadSavedConfig();
    hookHistory();
    boot();

    Object.defineProperty(window, 'BiliHomeCleanerDebug', {
        configurable: true,
        enumerable: false,
        value: {
            config: CONFIG,
            classify(element) {
                const card = getCardRoot(element);
                return card ? classifyCard(card) : null;
            },
            rescan() {
                processedCards = new WeakSet();
                initialScan();
            }
        }
    });
})();
