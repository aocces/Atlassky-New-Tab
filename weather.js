const WEATHER_TEXT_MAP = {
    0: "晴朗",
    1: "大部晴朗",
    2: "局部多云",
    3: "阴天",
    6: "有雾",
    45: "有雾",
    48: "有雾",
    51: "小毛毛雨",
    53: "毛毛雨",
    55: "浓毛毛雨",
    61: "小雨",
    63: "中雨",
    65: "大雨",
    71: "小雪",
    73: "中雪",
    75: "大雪",
    80: "阵雨",
    81: "强阵雨",
    82: "暴雨",
    95: "雷暴"
};

const WEATHER_ICON_MAP = {
    0: "☀",
    1: "🌤",
    2: "⛅",
    3: "☁",
    45: "🌫",
    48: "🌫",
    51: "🌦",
    53: "🌦",
    55: "🌧",
    61: "🌦",
    63: "🌧",
    65: "🌧",
    71: "❄",
    73: "❄",
    75: "❄",
    80: "🌦",
    81: "🌧",
    82: "⛈",
    95: "⛈"
};

/**
 * 手动可选的城市清单。
 *
 * 存在的意义：`navigator.geolocation` 在部分环境下拿不到结果（例如 Windows 系统代理
 * 劫持了系统定位服务，见项目备忘），而天气不该因此变成一句死文案。用户在设置里手动
 * 指定城市后，定位会被完全跳过 —— 既不请求、也不消耗定位授权。
 *
 * 每个条目带三份检索用的键，手感对齐 12306 的选站：
 *   pinyin —— 全拼，如「哈尔滨」是 haerbin（不是 id 的 harbin）
 *   abbr   —— 拼音首字母，如 bj、heb
 *   aliases—— 补充写法，港澳台用英文缩写
 * 三份键允许撞车（深圳 / 苏州同为 sz），这正是 12306 的手感：
 * 打两个字母，出来几个候选让你挑。
 */
const WEATHER_CITIES = [
    { id: "beijing", name: "北京", pinyin: "beijing", abbr: "bj", latitude: 39.9042, longitude: 116.4074 },
    { id: "shanghai", name: "上海", pinyin: "shanghai", abbr: "sh", latitude: 31.2304, longitude: 121.4737 },
    { id: "tianjin", name: "天津", pinyin: "tianjin", abbr: "tj", latitude: 39.3434, longitude: 117.3616 },
    { id: "chongqing", name: "重庆", pinyin: "chongqing", abbr: "cq", latitude: 29.563, longitude: 106.5516 },
    { id: "guangzhou", name: "广州", pinyin: "guangzhou", abbr: "gz", latitude: 23.1291, longitude: 113.2644 },
    { id: "shenzhen", name: "深圳", pinyin: "shenzhen", abbr: "sz", latitude: 22.5431, longitude: 114.0579 },
    { id: "hangzhou", name: "杭州", pinyin: "hangzhou", abbr: "hz", latitude: 30.2741, longitude: 120.1551 },
    { id: "nanjing", name: "南京", pinyin: "nanjing", abbr: "nj", latitude: 32.0603, longitude: 118.7969 },
    { id: "suzhou", name: "苏州", pinyin: "suzhou", abbr: "sz", latitude: 31.2989, longitude: 120.5853 },
    { id: "wuhan", name: "武汉", pinyin: "wuhan", abbr: "wh", latitude: 30.5928, longitude: 114.3055 },
    { id: "chengdu", name: "成都", pinyin: "chengdu", abbr: "cd", latitude: 30.5728, longitude: 104.0668 },
    { id: "xian", name: "西安", pinyin: "xian", abbr: "xa", latitude: 34.3416, longitude: 108.9398 },
    { id: "changsha", name: "长沙", pinyin: "changsha", abbr: "cs", latitude: 28.2282, longitude: 112.9388 },
    { id: "zhengzhou", name: "郑州", pinyin: "zhengzhou", abbr: "zz", latitude: 34.7466, longitude: 113.6254 },
    { id: "shenyang", name: "沈阳", pinyin: "shenyang", abbr: "sy", latitude: 41.8057, longitude: 123.4315 },
    { id: "dalian", name: "大连", pinyin: "dalian", abbr: "dl", latitude: 38.914, longitude: 121.6147 },
    { id: "harbin", name: "哈尔滨", pinyin: "haerbin", abbr: "heb", latitude: 45.8038, longitude: 126.535 },
    { id: "changchun", name: "长春", pinyin: "changchun", abbr: "cc", latitude: 43.8171, longitude: 125.3235 },
    { id: "jinan", name: "济南", pinyin: "jinan", abbr: "jn", latitude: 36.6512, longitude: 117.1201 },
    { id: "qingdao", name: "青岛", pinyin: "qingdao", abbr: "qd", latitude: 36.0671, longitude: 120.3826 },
    { id: "hefei", name: "合肥", pinyin: "hefei", abbr: "hf", latitude: 31.8206, longitude: 117.2272 },
    { id: "fuzhou", name: "福州", pinyin: "fuzhou", abbr: "fz", latitude: 26.0745, longitude: 119.2965 },
    { id: "xiamen", name: "厦门", pinyin: "xiamen", abbr: "xm", latitude: 24.4798, longitude: 118.0894 },
    { id: "nanchang", name: "南昌", pinyin: "nanchang", abbr: "nc", latitude: 28.682, longitude: 115.8579 },
    { id: "shijiazhuang", name: "石家庄", pinyin: "shijiazhuang", abbr: "sjz", latitude: 38.0428, longitude: 114.5149 },
    { id: "taiyuan", name: "太原", pinyin: "taiyuan", abbr: "ty", latitude: 37.8706, longitude: 112.5489 },
    { id: "hohhot", name: "呼和浩特", pinyin: "huhehaote", abbr: "hhht", latitude: 40.8426, longitude: 111.7492 },
    { id: "lanzhou", name: "兰州", pinyin: "lanzhou", abbr: "lz", latitude: 36.0611, longitude: 103.8343 },
    { id: "xining", name: "西宁", pinyin: "xining", abbr: "xn", latitude: 36.6171, longitude: 101.7782 },
    { id: "yinchuan", name: "银川", pinyin: "yinchuan", abbr: "yc", latitude: 38.4872, longitude: 106.2309 },
    { id: "urumqi", name: "乌鲁木齐", pinyin: "wulumuqi", abbr: "wlmq", latitude: 43.8256, longitude: 87.6168 },
    { id: "lhasa", name: "拉萨", pinyin: "lasa", abbr: "ls", latitude: 29.65, longitude: 91.1 },
    { id: "kunming", name: "昆明", pinyin: "kunming", abbr: "km", latitude: 24.8801, longitude: 102.8329 },
    { id: "guiyang", name: "贵阳", pinyin: "guiyang", abbr: "gy", latitude: 26.647, longitude: 106.6302 },
    { id: "nanning", name: "南宁", pinyin: "nanning", abbr: "nn", latitude: 22.817, longitude: 108.3665 },
    { id: "haikou", name: "海口", pinyin: "haikou", abbr: "hk", latitude: 20.0444, longitude: 110.1999 },
    { id: "sanya", name: "三亚", pinyin: "sanya", abbr: "sy", latitude: 18.2528, longitude: 109.5119 },
    { id: "hongkong", name: "中国香港", pinyin: "xianggang", abbr: "xg", aliases: ["hk"], latitude: 22.3193, longitude: 114.1694 },
    { id: "macau", name: "中国澳门", pinyin: "aomen", abbr: "am", aliases: ["mo"], latitude: 22.1987, longitude: 113.5439 },
    { id: "taipei", name: "中国台北", pinyin: "taibei", abbr: "tb", latitude: 25.033, longitude: 121.5654 }
];

/**
 * 城市检索，手感对齐 12306 的车站搜索：
 * 汉字、全拼、首字母、混着打都能命中，且「以输入开头」的排在前面；
 * 命中不了的返回空数组（由调用方给出「没有匹配的城市」）。
 *
 * 优先级：汉字全等 > 汉字开头 > 全拼/首字母/别名全等 > 汉字包含 > 键开头 > 键包含。
 * 同一档里保持清单原有顺序，所以「sz」永远是深圳在苏州前面，结果稳定。
 */
function matchWeatherCities(query) {
    const q = String(query || "").trim().toLowerCase().replace(/\s+/g, "");
    if (!q) return WEATHER_CITIES.slice();

    const hits = [];

    WEATHER_CITIES.forEach((city, index) => {
        // 三份键都可能缺，filter 掉空值再比，避免 undefined.includes 抛错
        const keys = [city.abbr, city.pinyin, city.id]
            .concat(city.aliases || [])
            .filter(Boolean);

        let score = 0;
        if (city.name === q) score = 100;
        else if (city.name.startsWith(q)) score = 90;
        else if (keys.some((key) => key === q)) score = 80;
        else if (city.name.includes(q)) score = 70;
        else if (keys.some((key) => key.startsWith(q))) score = 60;
        else if (keys.some((key) => key.includes(q))) score = 40;

        if (score > 0) hits.push({ city, score, index });
    });

    hits.sort((a, b) => b.score - a.score || a.index - b.index);
    return hits.map((hit) => hit.city);
}

/** 系统时区 → 城市。命中不了时统一回落到北京（清单第一项）。 */
const WEATHER_TIMEZONE_CITY = {
    "Asia/Shanghai": "shanghai",
    "Asia/Chongqing": "chongqing",
    "Asia/Harbin": "harbin",
    "Asia/Urumqi": "urumqi",
    "Asia/Kashgar": "urumqi",
    "Asia/Hong_Kong": "hongkong",
    "Asia/Macau": "macau",
    "Asia/Taipei": "taipei"
};

/** 定位超时。拿不到就走去时区兜底，没必要让用户干等。 */
const WEATHER_GEO_TIMEOUT = 6000;

function readWeatherSettings() {
    try {
        return JSON.parse(localStorage.getItem("settings") || "{}") || {};
    } catch (error) {
        return {};
    }
}

function findWeatherCity(id) {
    if (!id) return null;
    return WEATHER_CITIES.find((city) => city.id === id) || null;
}

/** 用户手动指定的城市；未指定（或指向了已不存在的 id）返回 null。 */
function resolveManualWeatherCity() {
    return findWeatherCity(readWeatherSettings().weatherCity);
}

function inferWeatherCityFromTimezone() {
    let timeZone = "";

    try {
        timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    } catch (error) {
        timeZone = "";
    }

    return findWeatherCity(WEATHER_TIMEZONE_CITY[timeZone]) || WEATHER_CITIES[0];
}

function buildWeatherTitle(city, source) {
    if (source === "manual" && city) return `${city.name}（手动指定）· 数据来自 Open-Meteo`;
    if (source === "timezone" && city) return `${city.name}（按系统时区推断）· 数据来自 Open-Meteo`;
    return "当前位置 · 数据来自 Open-Meteo";
}

function markResolvedCity(city, source) {
    const weatherBox = document.getElementById("weatherBox");
    if (!weatherBox) return;

    weatherBox.dataset.citySource = source;
    weatherBox.dataset.city = city ? city.name : "";
    weatherBox.title = buildWeatherTitle(city, source);
}

function notifyWeatherResolved(city, source) {
    try {
        window.dispatchEvent(
            new CustomEvent("weatherresolved", {
                detail: { city: city ? city.name : "", source }
            })
        );
    } catch (error) {
        /* CustomEvent 不可用时静默降级，不影响天气本身 */
    }
}

function renderWeather(weatherData, city = null, source = "geo") {
    const weatherIcon = document.getElementById("weatherIcon");
    const weatherText = document.getElementById("weatherText");
    const weatherBox = document.getElementById("weatherBox");

    if (!weatherIcon || !weatherText || !weatherBox) return;

    const current = weatherData?.current;

    if (!current) {
        weatherIcon.textContent = "☁";
        weatherText.textContent = "天气信息暂不可用";
        return;
    }

    const code = current.weather_code;
    const temp = Math.round(current.temperature_2m);

    const text = WEATHER_TEXT_MAP[code] || "未知天气";
    const icon = WEATHER_ICON_MAP[code] || "☁";

    weatherIcon.textContent = icon;
    weatherText.textContent = `${temp}° ${text}`;

    weatherBox.style.cursor = "pointer";
    weatherBox.onclick = () => {
        window.open("https://www.msn.com/weather", "_blank");
    };

    markResolvedCity(city, source);
    notifyWeatherResolved(city, source);
}

function renderWeatherError(message = "天气信息暂不可用") {
    const weatherIcon = document.getElementById("weatherIcon");
    const weatherText = document.getElementById("weatherText");
    const weatherBox = document.getElementById("weatherBox");

    if (weatherBox) {
        weatherBox.classList.remove("hidden");
    }

    if (weatherIcon) weatherIcon.textContent = "☁";
    if (weatherText) weatherText.textContent = message;
}

async function fetchWeatherByCoords(latitude, longitude) {
    const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
        `&current=temperature_2m,weather_code&timezone=auto`;

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error("天气接口请求失败");
    }

    return await response.json();
}

async function loadWeatherForCity(city, source) {
    const weatherData = await fetchWeatherByCoords(city.latitude, city.longitude);
    renderWeather(weatherData, city, source);
}

function initWeather(forceRequest = false) {
    try {
        const settings = readWeatherSettings();

        if (!settings.weather) return;

        const weatherBox = document.getElementById("weatherBox");
        if (weatherBox) {
            // 清掉上一次的结果，避免设置面板把旧来源当成这次的结果
            weatherBox.dataset.citySource = "";
            weatherBox.dataset.city = "";
        }

        // ① 用户手动指定了城市 —— 完全不碰定位：不请求、不消耗授权
        const manualCity = resolveManualWeatherCity();

        if (manualCity) {
            loadWeatherForCity(manualCity, "manual").catch((error) => {
                console.error("天气请求失败：", error);
                renderWeatherError("天气信息暂不可用");
            });
            return;
        }

        // ② 自动 —— 定位优先，拿不到就用系统时区推断，绝不把用户留在死路上
        const useTimezoneFallback = () => {
            loadWeatherForCity(inferWeatherCityFromTimezone(), "timezone").catch((error) => {
                console.error("天气请求失败：", error);
                renderWeatherError("天气信息暂不可用");
            });
        };

        if (!navigator.geolocation) {
            useTimezoneFallback();
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const weatherData = await fetchWeatherByCoords(
                        position.coords.latitude,
                        position.coords.longitude
                    );
                    renderWeather(weatherData, null, "geo");
                } catch (error) {
                    console.error("天气请求失败：", error);
                    renderWeatherError("天气信息暂不可用");
                }
            },
            (error) => {
                console.warn("定位失败，改用系统时区推断的城市：", error?.message || error);
                useTimezoneFallback();
            },
            {
                enableHighAccuracy: false,
                timeout: WEATHER_GEO_TIMEOUT,
                maximumAge: forceRequest ? 0 : 10 * 60 * 1000
            }
        );
    } catch (error) {
        console.error("天气初始化失败：", error);
        renderWeatherError("天气信息暂不可用");
    }
}

window.WEATHER_CITIES = WEATHER_CITIES;
window.matchWeatherCities = matchWeatherCities;
window.initWeather = initWeather;
window.renderWeatherError = renderWeatherError;
