let PAGE_CAPACITY = 0;
let MAX_PAGE = 0;
let CURRENT_PAGE = 0;
let CURRENT_MAX_USER = 0;
const API_KEY = "3632dd9656a54c6d90b31777940b2581";
const DOM_USER_COPY = "<div class='user-wrap'><div class='user'><div class='emblem'></div><div class='platform'><img draggable='false' src=''></div><div class='display-name'></div><button class='copy material-icons' data-bungie-name='' data-icon='content_copy'></button></div></div>";
const DOM_USER_DIRECT = "<div class='user-wrap'><div class='user'><div class='emblem'></div><div class='platform'><img draggable='false' src=''></div><div class='display-name'></div><button class='copy material-icons' data-bungie-name='' data-icon='login'></button></div></div>";
let DOM_USER = DOM_USER_COPY;
let GROUP_ID;

let clipboard;
let isCtrlPressed = false;
let cmd_lang = "ko";
let cmd_join = "합류";
let cmd_invite = "초대";
let mode = "copy";
let my_bungie_name;
let lastUpdate;
let active_window_update;

const loadLocalStorageJSON = function (key) {
    let item = localStorage.getItem(key);
    if (item === null) return {};
    else return JSON.parse(localStorage.getItem(key));
}

const saveLocalStorageJSON = function (key, item) {
    localStorage.setItem(key, JSON.stringify(item))
}

const requestBungieAPI = async function (endpoint) {
    let resp = await fetch("https://www.bungie.net/Platform" + endpoint, {
        headers: {"X-API-Key": API_KEY}
    });
    if (resp.status === 200) {
        return resp.json();
    }
    else {
        let resp_json = await resp.json();
        console.log(resp_json);
        throw new Error(resp_json.ErrorStatus + ": " + resp_json.Message);
    }
}


const selectElements = function (selector) {
    return Array.from(document.querySelectorAll(selector));
}

const selectElement = function (selector) {
    return document.querySelector(selector)
}

// ================ /clan ================ //
const filterClanList = function(s) {
    let rows = selectElements(".clan-info");
    let hasResult = 0;
    let lowerStr = s.toLowerCase();
    // smartCase
    let cmp = (lowerStr === s) ? (a => a.toLowerCase().includes(lowerStr)) : (a => a.includes(s));
    rows.forEach((el) => {
        if (cmp(el.textContent.trim().replace(/\n[ ]+/g, "\n").replace(/^[\w_]+\n/, ""))) {
            el.style.display = "";
            hasResult = 1;
        }
        else {
            el.style.display = "none";
        }
    });
    if (hasResult === 0) document.getElementById("no-result").style.display = "";
    else document.getElementById("no-result").style.display = "none";
};

const _cmpNameASC = function (a, b) {return a.innerText > b.innerText ? 1 : -1;};
const _cmpNameDESC = function (a, b) {return a.innerText > b.innerText ? -1 : 1;};
const _cmpGroupIdASC = function(a, b) {
    let num_a = parseInt(/\/clan\/(\d+)/.exec(a.children[0].href)[1])
    let num_b = parseInt(/\/clan\/(\d+)/.exec(b.children[0].href)[1])
    return num_a - num_b;
};
const _cmpGroupIdDESC = function(a, b) {
    return -_cmpGroupIdASC(a, b);
};
const _cmpMemberCountASC = function (a, b) { return a.dataset.memberCount - b.dataset.memberCount;};
const _cmpMemberCountDESC = function (a, b) { return b.dataset.memberCount - a.dataset.memberCount;};

const sortClanList = function(e) {
    const cmp = {
        "nameASC": _cmpNameASC,
        "nameDESC": _cmpNameDESC,
        "idASC": _cmpGroupIdASC,
        "idDESC": _cmpGroupIdDESC,
        "memberCountASC": _cmpMemberCountASC,
        "memberCountDESC": _cmpMemberCountDESC,
    };
    let el_clan_list = selectElement(".clan-list");
    selectElements(".clan-list > .clan-info").sort(cmp[e.value]).forEach(el => el_clan_list.appendChild(el));
};

const toggleBookmark = function (el) {
    el.classList.toggle("bookmark");
    let group_id = el.parentElement.parentElement.getAttribute("href").match(/\/clan\/([0-9]+)/)[1];
    if (!group_id) {
        console.log("ERROR: cannot save bookmark status change")
        return;
    }
    // 북마크 목록 (localStorage) 추가 제거 기능
    let data = loadLocalStorageJSON("bookmark");
    if (el.classList.contains("bookmark")) data[group_id] = "";
    else delete data[group_id];
    saveLocalStorageJSON("bookmark", data);
}

const loadBookmark = function () {
    let data = loadLocalStorageJSON("bookmark");
    let clan_list = selectElements(".clan-info");
    clan_list.forEach((el) => {
        let gid = el.firstElementChild.href.match(/\/clan\/([0-9]+)/)[1];
        if (gid in data) el.classList.add("bookmark");
    });
}


// ================ /clan/<group_id> ================ //

const getMaxUserCount = function () {
    let ww = window.innerWidth;
    let c;

    if (ww > 1440) c = 4;
    else if (ww > 960) c = 3;
    else if (ww > 640) c = 2;
    else c = 1;

    return CURRENT_MAX_USER = Math.floor(selectElement(".user-list").clientHeight / 44) * c;
};


const setPage = function (p = CURRENT_PAGE) {
    let prev_page_count = CURRENT_MAX_USER;
    let page_count = getMaxUserCount();
    let total_user = selectElements(".user").length;
    let max_page = Math.ceil(total_user / page_count) - 1;

    if (p === CURRENT_PAGE && prev_page_count === page_count) return;
    if (page_count === PAGE_CAPACITY && p === CURRENT_PAGE) return;

    if (p > max_page) p = 0;
    selectElements(".user-wrap").forEach((el, i) => {
        if (Math.floor(i / page_count) === p && el.classList.contains("hide")) {
            el.classList.remove("hide");
        } else if (Math.floor(i / page_count) !== p && !el.classList.contains("hide")) {
            el.classList.add("hide");
        }
    });
    PAGE_CAPACITY = page_count;
    MAX_PAGE = max_page;
    CURRENT_PAGE = p;

    // console.log(CURRENT_PAGE + " / " + MAX_PAGE);
    selectElement(".info-page").textContent = `${CURRENT_PAGE + 1} / ${MAX_PAGE + 1} 페이지`;

    document.getElementById("prevPage").disabled = CURRENT_PAGE === 0;
    document.getElementById("nextPage").disabled = CURRENT_PAGE === MAX_PAGE;
};

const nextPage = function() {
    if (MAX_PAGE < CURRENT_PAGE + 1) return;
    setPage(CURRENT_PAGE + 1);
}

const prevPage = function() {
    if (CURRENT_PAGE < 1) return;
    setPage(CURRENT_PAGE - 1);
}

const adjustUserElementCount = function(n) {
    let total_user = selectElements(".user").length;
    let el_user_list = selectElement(".user-list")
    if (total_user < n) {
        for(let i=total_user; i<n; i++) el_user_list.insertAdjacentHTML("beforeend", DOM_USER);
    }
    else if (total_user > n) selectElements(`.user-wrap:nth-last-child(-n+${total_user - n})`).forEach(el => el.remove());
}

const mkCmd = function (s) {
    if (isCtrlPressed) return "/" + cmd_invite +" " + s;
    else return "/" + cmd_join + " " + s;
}

const ctrlObserverInit = function () {
    document.addEventListener("keydown", function (event) {
        if (event.ctrlKey) isCtrlPressed = true;
    });
    document.addEventListener("keyup", function (event) {
        if (event.ctrlKey || event.key === "Control") isCtrlPressed = false;
    });
}

const clipboardInitialize = function() {
    if (clipboard != null) clipboard.destroy();
    clipboard = new ClipboardJS('.copy', {
        text: function(trigger) { return mkCmd(trigger.getAttribute('data-bungie-name')) }
    });
    clipboard.on("success", function(e) {
        console.log("Copy success");
        e.trigger.classList.add("copied");
        setTimeout(function () { e.trigger.classList.remove("copied"); }, 2000);
    });
    clipboard.on("error", function() {
        console.log("Copy ERROR");
    });
}

const directJoinInitialize = function () {
    selectElements("copy").forEach((el) => {
       el.onclick = function() {
            console.log("Click!");
            location.href = "steam://rungame/1085660/" + this.getAttribute("data-bungie-name");
        }
    });
}

const initMembers = async function(groupId) {
    // 상수값 설정
    GROUP_ID = groupId;
    // 현재 모드 따라 아이콘 모양 바꾸기
    let copy_icon = selectElements(".copy");
    if (mode === "direct") copy_icon.forEach(el => el.setAttribute("data-icon", "login"));
    else copy_icon.forEach(el => el.setAttribute("data-icon", "content_copy"));

    // 데이터 업데이트 수행
    await updateMembers(groupId);
}

const updateMembers = async function(groupId) {
    // 업데이트 시작
    updateMembersStart();

    try {
        // Bungie.net API Members 요청
        let resp_members = await requestBungieAPI("/GroupV2/" + groupId + "/Members/")
        // 결과값 배열 복사
        let arr_members = resp_members.Response.results.slice();
        let online_members = arr_members.filter(el => el.isOnline).length;
        // .user 요소 개수 맞추기
        adjustUserElementCount(arr_members.length);
        let user_el = Array.from(document.getElementsByClassName("user"));

        // 클랜 멤버 목록 정렬
        arr_members.sort((a, b) => {
            if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
            else return a.destinyUserInfo.LastSeenDisplayName < b.destinyUserInfo.LastSeenDisplayName ? -1 : a.destinyUserInfo.LastSeenDisplayName > b.destinyUserInfo.LastSeenDisplayName ? 1: 0;
        });

        // 화면에 적용
        user_el.forEach((el, idx) => {
            // el.children[0]: .emblem
            // el.children[1]: .platform
            // el.children[2]: .display-name
            // el.children[3]: button.copy
            let display_name = arr_members[idx].destinyUserInfo.LastSeenDisplayName;
            let bungie_name = arr_members[idx].destinyUserInfo.bungieGlobalDisplayName + "#" + arr_members[idx].destinyUserInfo.bungieGlobalDisplayNameCode;
            let platform_icon = "https://www.bungie.net" + arr_members[idx].destinyUserInfo.iconPath;
            el.children[2].textContent = display_name;
            el.children[2].setAttribute("title", display_name);
            resetEmblem(el);

            if (arr_members[idx].isOnline) {
                // 온라인 + 번지 이름 정보 존재
                el.classList.add("online");
                el.classList.remove("error");
                el.children[1].children[0].setAttribute("src", platform_icon);
                el.children[3].dataset.bungieName = bungie_name;
                if (my_bungie_name === bungie_name) el.classList.add("me");
                else el.classList.remove("me");
                setTimeout(() => applyMemberEmblem(el, arr_members[idx]), idx * 30);
            }
            // 오프라인
            else {
                el.classList.remove("error", "online", "me");
                el.children[1].children[0].setAttribute("src", "");
                el.children[3].dataset.bungieName = "";
            }
        });

        // 페이지 위치, 복사-합류 버튼 초기화
        setPage(0);
        if (mode === "direct") directJoinInitialize();
        else clipboardInitialize();
        // 완료 메시지
        selectElements(".info-online").forEach((el) => { el.textContent = `${online_members} / ${arr_members.length} 온라인`;});
        let refresh_button = document.getElementById("refresh");
        refresh_button.dataset.icon = "done";
        refresh_button.disabled = false;
    } catch (e) {
        console.log(e)
        selectElements(".info-online").forEach((el) => { el.textContent = "오류 발생!";});
        generateModal("이런!", "업데이트 도중 오류가 발생하였습니다!<br>" + e, "닫기", true);
    } finally {
        // 업데이트 끝. 원상 복귀
        updateMembersEnd();
    }
}

const updateMembersStart = function () {
    lastUpdate = Date.now();
    let refresh_button = document.getElementById("refresh");
    refresh_button.disabled = true;
    refresh_button.dataset.icon = "hourglass_bottom";
    selectElements(".user-list")[0].classList.add("loading");
}

const updateMembersEnd = function (isSuccess = true) {
    setTimeout(() => { document.getElementById("refresh").dataset.icon = "refresh"; }, 1000);
    selectElement(".user-list").classList.remove("loading");
}

const resetEmblem = function (el) {
    el.style.backgroundColor = "";
    if (el.children[0].lastElementChild) el.children[0].lastElementChild.remove();
}

const applyMemberEmblem = async function (el, data) {
    let m_id = data.destinyUserInfo.membershipId;
    let m_type = data.destinyUserInfo.membershipType;

    // 유저 프로필 정보 불러오기
    let profile = await requestProfile(m_type, m_id);
    if (profile === null) return;

    // 최근 접속 캐릭터 찾은 후, 문양 이미지 주소 저장
    let recentChar = getRecentProfile(profile);
    let path = "https://www.bungie.net" + recentChar.emblemPath;
    let img = new Image();
    img.crossOrigin = "anonymous";
    img.draggable = false;
    img.onload = () => {
        let color = getEdgeAvgColor(img);
        el.style.backgroundColor = `rgb(${color[0]}, ${color[1]}, ${color[2]})`
    }
    img.onerror = () => {
        img.src = "";
    }

    // 변경 적용 (배경색은 초기화)
    img.src = path;
    el.children[0].append(img)
}

const requestProfile = async function (m_type, m_id) {
    try {
        let resp = await requestBungieAPI("/Destiny2/" + m_type + "/Profile/" + m_id + "/?components=200");
        if (resp.Response.characters.privacy !== 1) return null;
        else return resp.Response.characters.data;
    } catch {
        return null;
    }
}

const getRecentProfile = function (data) {
    let lastPlayedCharID = undefined;
    let lastPlayed = "1970-01-01T00:00:00Z"
    for (const dataKey in data) {
        if (data[dataKey].dateLastPlayed > lastPlayed) {
            lastPlayed = data[dataKey].dateLastPlayed;
            lastPlayedCharID = dataKey;
        }
    }
    return data[lastPlayedCharID];
}

const refreshMembers = async function() {
    if (Date.now() - lastUpdate < 5000) return;
    await updateMembers(GROUP_ID);
}

const getEdgeAvgColor = function(img) {
    let canvas = document.createElement("canvas");
    let context = canvas.getContext("2d");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    context.drawImage(img, 0, 0, 96, 96);
    let data = context.getImageData(92, 0, 4, 96).data;
    let r, g, b;
    r = g = b = 0;
    for (let i = 0; i < 1536; i+=4) {
        r += data[i];
        g += data[i+1];
        b += data[i+2];
    }
    return [r, g, b].map(value => { return Math.floor(value / 523 + 16) });
}

// ================ /request ================ //
const _showClanContainer = function() {
    selectElement(".clan-container").style.display = "";
    selectElement(".error-msg-box").style.display = "none";
}
const _hideClanContainer = function() {
    selectElement(".clan-container").style.display = "none";
    selectElement(".error-msg-box").style.display = "";
    selectElement(".error-msg-box h2").textContent = "검색 결과가 없습니다.";
}

const _editClanContainer = function(name, callsign, motto, count, group_id) {
    selectElement(".clan-name").textContent = name;
    selectElement(".clan-callsign").textContent = callsign;
    selectElement(".clan-motto").textContent = motto;
    selectElement(".clan-member-count").textContent = count + "명";
    selectElement(".link-btn").href = "https://www.bungie.net/ko/ClanV2?groupid=" + group_id;
    selectElement(".request-btn").dataset.groupId = group_id;
}

const getGroupByName = function(name) {
    _hideClanContainer();
    selectElement(".error-msg-box h2").textContent = "검색중..."
    requestBungieAPI("/GroupV2/Name/" + name + "/1")
    .then(data => {
        _editClanContainer(
            data.Response.detail.name,
            data.Response.detail.clanInfo.clanCallsign,
            data.Response.detail.motto,
            data.Response.detail.memberCount,
            data.Response.detail.groupId
        );
        _showClanContainer();
        if (data.Response.detail.memberCount < 10) {
            selectElement(".request-btn").document.getElementById("nextPage");
        }
    })
    .catch(() => {
        _hideClanContainer();
    });
}

const clanAddRequest = function(el) {
    let group_id = el.getAttribute("data-group-id");
    fetch("/api/clan/add/" + group_id)
    .then(resp => resp.json())
    .then(data => {
        if (data.result) alert("신청이 완료되었습니다. 적용에는 시간이 걸리니 조금만 기다려주세요.");
        else alert("등록 신청 실패: " + data.message);
    })
    .catch(() => {alert("등록 신청 실패.")})
}

const searchSubmit = function(e) {
    e.preventDefault();
    getGroupByName(document.getElementById("clan-search").value);
}

// ================ /setting ================ //
// mode select
const getMode = function () {
    // windows 인 경우에는 기본값이 direct, 아닌 경우 copy
    let _mode = localStorage.getItem("mode");
    if (_mode) return _mode;
    else if (window.navigator.userAgent.toLowerCase().indexOf("windows") > -1) {
        localStorage.setItem("mode", "direct");
        return "direct";
    }
    else {
        localStorage.setItem("mode", "copy");
        return "copy";
    }
}

const setMode = function (m) {
    console.log("setmode: " + m)
    if (m === "direct") {
        mode = m;
        localStorage.setItem("mode", m);
    }
    else if (m === "copy") {
        mode = m;
        localStorage.setItem("mode", m);
    }
    else {
        console.log("ERROR: Invalid mode input");
        mode = getMode();
    }
}

const getCommandPrefix = function() {
    // localStorage 값이 있으면 불러오고, 없으면 기본값 (합류/초대) 사용
    // "setting": {"cmd_invite": "invite", "cmd_join": "join", "cmd_lang": "en"}
    let setting = loadLocalStorageJSON("setting");
    if (Object.keys(setting).length === 0) setCommandPrefixByLang("ko");
    else {
        cmd_lang = setting.cmd_lang !== undefined ? setting.cmd_lang : "ko";
        cmd_invite = setting.cmd_invite ? setting.cmd_invite : "초대";
        cmd_join = setting.cmd_join ? setting.cmd_join : "합류";
    }
}

const setCommandPrefix = function (join, invite, lang) {
    let setting = loadLocalStorageJSON("setting");
    setting.cmd_join = join;
    setting.cmd_invite = invite;
    setting.cmd_lang = lang;
    cmd_join = join;
    cmd_invite = invite;
    cmd_lang = lang;
    saveLocalStorageJSON("setting", setting);
}

const setCommandPrefixByLang = function (lang) {
    if (lang === "ko") setCommandPrefix("합류", "초대", "ko");
    else if (lang === "en") setCommandPrefix("join", "invite", "en");
    else setCommandPrefix("합류", "초대", "");
}

const initCommandPrefix = function () {
    getCommandPrefix();
    let el_cmd_join = document.getElementById("cmd_join");
    let el_cmd_invite = document.getElementById("cmd_invite");
    if (cmd_lang.length > 0) {
        el_cmd_join.value = cmd_join;
        el_cmd_join.setAttribute("readonly", "readonly");
        el_cmd_invite.value = cmd_invite;
        el_cmd_invite.setAttribute("readonly", "readonly");
        if (cmd_lang === "ko") selectElement("input[name=lang][value=ko]").checked = true;
        else if (cmd_lang === "en") selectElement("input[name=lang][value=en]").checked = true;
    }
    else {
        el_cmd_join.value = cmd_join;
        el_cmd_join.removeAttribute("readonly");
        el_cmd_invite.value = cmd_invite;
        el_cmd_invite.removeAttribute("readonly");
        selectElement("input[name=lang][value='']").checked = true;
    }
}

const radioSetCmdPrefix = function (el) {
    setCommandPrefixByLang(el.value);
    let el_cmd_join = document.getElementById("cmd_join");
    let el_cmd_invite = document.getElementById("cmd_invite");
    el_cmd_join.value = cmd_join;
    el_cmd_join.setAttribute("readonly", "readonly");
    el_cmd_invite.value = cmd_invite;
    el_cmd_invite.setAttribute("readonly", "readonly");
}

const textSetCmdPrefix = function () {
    cmd_join = document.getElementById("cmd_join").value;
    cmd_invite = document.getElementById("cmd_invite").value;
    cmd_lang = "";
    setCommandPrefix(cmd_join, cmd_invite, cmd_lang);
}

const enableCmdBox = function () {
    document.getElementById("cmd_join").removeAttribute("readonly");
    document.getElementById("cmd_invite").removeAttribute("readonly");
    cmd_lang = "";
    setCommandPrefix(cmd_join, cmd_invite, cmd_lang);
}

const getMyBungieName = function() {
    let setting = loadLocalStorageJSON("setting");
    if (setting.hasOwnProperty("my_bungie_name")) {
        my_bungie_name = setting.my_bungie_name;
        return my_bungie_name;
    }
}

const setMyBungieName = function (b_name) {
    let setting = loadLocalStorageJSON("setting");
    setting["my_bungie_name"] = b_name;
    my_bungie_name = b_name;
    saveLocalStorageJSON("setting", setting);
}

const getAutoUpdateSetting = function () {
    let setting = loadLocalStorageJSON("setting");
    if (setting.hasOwnProperty("active_window_update")) {
        active_window_update = setting.active_window_update;
        return active_window_update;
    } else {
        setAutoUpdateSetting(true);
        return active_window_update;
    }
}

const setAutoUpdateSetting = function (value=true) {
    let setting = loadLocalStorageJSON("setting");
    setting["active_window_update"] = value;
    active_window_update = value;
    saveLocalStorageJSON("setting", setting);
}
// ================ modal ================ //
const generateModal = function (title, text, btn, no_duplicate) {
    if (no_duplicate && selectElement(".modal-bg")) return;

    let modal_bg = document.createElement("div");
    let modal_wrap = document.createElement("div")
    let modal  = document.createElement("div")
    modal_bg.classList.add("modal-bg");
    modal_wrap.classList.add("modal-box-wrap", "container")
    modal.classList.add("modal-box")

    let modal_title = document.createElement("h2")
    modal_title.classList.add("modal-box-title")
    modal_title.innerHTML = title;
    let modal_text = document.createElement("p")
    modal_text.classList.add("modal-box-text")
    modal_text.innerHTML = text
    let modal_btn = document.createElement("button")
    modal_btn.classList.add("modal-box-btn");
    modal_btn.innerText = btn
    modal_btn.addEventListener("click", (e) => closeModal(e, modal_bg));
    let modal_btn_wrap = document.createElement("div")
    modal_btn_wrap.classList.add("modal-box-btn-wrap")
    modal_btn_wrap.appendChild(modal_btn);
    modal.append(modal_title, modal_text, modal_btn_wrap);

    modal_wrap.appendChild(modal)
    modal_bg.appendChild(modal_wrap);
    modal_bg.addEventListener("click", (e) => closeModal(e, modal_bg))
    selectElement("body").appendChild(modal_bg);
    selectElement("main").classList.add("blur")
}

const closeModal = function (ev, el) {
    // el == div.modal_bg
    if (ev.target === ev.currentTarget && el.classList.contains("modal-bg")) {
        el.remove();
        selectElement("main").classList.remove("blur")
    }
}


// ================ initializing ================ //
getCommandPrefix();
getMyBungieName();
// mode = getMode();
mode = "copy";
DOM_USER = mode === "direct" ? DOM_USER_DIRECT : DOM_USER_COPY;
