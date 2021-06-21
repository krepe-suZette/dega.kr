let PAGE_CAPACITY = 0;
let MAX_PAGE = 0;
let CURRENT_PAGE = 0;
const API_KEY = "3632dd9656a54c6d90b31777940b2581";
const DOM_USER_COPY = $("<div class='user-wrap'><div class='user'><div class='emblem'></div><div class='display-name'></div><button class='copy material-icons' data-sid='' data-icon='content_copy'></button></div></div>");
const DOM_USER_DIRECT = $("<div class='user-wrap'><div class='user'><div class='emblem'></div><div class='display-name'></div><button class='copy material-icons' data-sid='' data-icon='login'></button></div></div>");
let DOM_USER = DOM_USER_COPY;
let GROUP_ID;

let clipboard;
let isCtrlPressed = false;
let cmd_lang = "ko";
let cmd_join = "합류";
let cmd_invite = "초대";
let mode = "copy";

const loadLocalStorageJSON = function (key) {
    let item = localStorage.getItem(key);
    if (item === null) return {};
    else return JSON.parse(localStorage.getItem(key));
}

const saveLocalStorageJSON = function (key, item) {
    localStorage.setItem(key, JSON.stringify(item))
}


// ================ /clan ================ //
const filterClanList = function(s) {
    // $(".clan-info").hide();
    let rows = $(".clan-info");
    let hasResult = 0;
    let lowerStr = s.toLowerCase();
    // smartCase
    let cmp = (lowerStr === s) ? (a => a.toLowerCase().includes(lowerStr)) : (a => a.includes(s));
    rows.each(function() {
        if (cmp(this.textContent.trim().replace(/\n[ ]+/g, "\n").replace(/^[\w_]+\n/, ""))) {
            $(this).show();
            hasResult = 1;
        }
        else {
            $(this).hide();
        }
    });
    if (hasResult === 0) $("#no-result").show();
    else $("#no-result").hide();
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
    $(".clan-list > .clan-info").sort(cmp[e.value]).appendTo(".clan-list");
};

const toggleBookmark = function (el) {
    let $el = $(el.parentElement.parentElement.parentElement);
    let ret = $el.toggleClass("bookmark").hasClass("bookmark");
    let group_id = el.parentElement.parentElement.getAttribute("href").match(/\/clan\/([0-9]+)/)[1];
    if (!group_id) {
        console.log("ERROR: cannot save bookmark status change")
        return;
    }
    // 북마크 목록 (localStorage) 추가 제거 기능
    let data = loadLocalStorageJSON("bookmark");
    if (ret) data[group_id] = "";
    else delete data[group_id];
    saveLocalStorageJSON("bookmark", data);
}

const loadBookmark = function () {
    let data = loadLocalStorageJSON("bookmark");
    let $clan_list = $(".clan-info");
    $clan_list.each((i, el) => {
        let gid = el.firstElementChild.href.match(/\/clan\/([0-9]+)/)[1];
        if (gid in data) $(el).addClass("bookmark");
    });
}


// ================ /clan/<group_id> ================ //

const getMaxUserCount = function () {
    let ww = $(window).width();
    let c;

    if (ww > 1440) c = 4;
    else if (ww > 960) c = 3;
    else if (ww > 640) c = 2;
    else c = 1;
    return Math.floor($(".user-list").height() / 44) * c;
};


const setPage = function (p) {
    let page_count = getMaxUserCount();
    let total_user = $(".user").length;
    let max_page = Math.ceil(total_user / page_count) - 1;

    if (page_count === PAGE_CAPACITY && p === CURRENT_PAGE) return;

    if (p > max_page) p = 0;
    $(".user-wrap").each(function (index, element) {
        if (Math.floor(index / page_count) === p && $(element).hasClass("hide")) {
            $(element).removeClass("hide");
        } else if (Math.floor(index / page_count) !== p && !$(element).hasClass("hide")) {
            $(element).addClass("hide");
        }
    });
    PAGE_CAPACITY = page_count;
    MAX_PAGE = max_page;
    CURRENT_PAGE = p;

    // console.log(CURRENT_PAGE + " / " + MAX_PAGE);
    $(".info-page").text(`${CURRENT_PAGE + 1} / ${MAX_PAGE + 1} 페이지`);

    if (CURRENT_PAGE === 0) $("#prevPage").attr("disabled", true);
    else $("#prevPage").attr("disabled", false);

    if (CURRENT_PAGE === MAX_PAGE) $("#nextPage").attr("disabled", true);
    else $("#nextPage").attr("disabled", false);
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
    let total_user = $(".user").length;
    if (total_user < n) {
        for(let i=total_user; i<n; i++) $(".user-list").append(DOM_USER.clone());
    }
    else if (total_user > n) $(`.user-wrap:gt(${n - 1})`).remove();
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
        text: function(trigger) { return mkCmd(trigger.getAttribute('data-sid')) }
    });
    clipboard.on("success", function(e) {
        console.log("Copy success");
        $(e.trigger).addClass("copied");
        setTimeout(function () { $(e.trigger).removeClass("copied"); }, 2000);
    });
    clipboard.on("error", function(e) {
        console.log("Copy ERROR");
    });
}

const directJoinInitialize = function () {
    $(".copy").click( function () {
        console.log("Click!");
        location.href = "steam://rungame/1085660/" + this.getAttribute("data-sid");
    });
}

const initMembers = async function(groupId) {
    // 상수값 설정
    GROUP_ID = groupId;
    // 현재 모드 따라 아이콘 모양 바꾸기
    let $copy_icon = $(".copy");
    if (mode === "direct") $copy_icon.attr("data-icon", "login");
    else $copy_icon.attr("data-icon", "content_copy");

    // 데이터 업데이트 수행
    await updateMembers(groupId);
}

const updateMembers = async function(groupId) {
    // 업데이트 시작
    updateMembersStart();

    try {
        // Bungie.net API Members 요청
        let resp_members = await $.ajax({
            url: "https://www.bungie.net/Platform/GroupV2/" + groupId + "/Members/",
            headers: { "X-API-Key": API_KEY }
        });
        // 결과값 배열 복사
        let arr_members = resp_members.Response.results.slice();
        // .user 요소 개수 맞추기
        adjustUserElementCount(arr_members.length);
        let $user_el = Array.from(document.getElementsByClassName("user")).map((el) => {return $(el)});

        // SteamID 값 불러오기
        let arr_online_id = arr_members.filter(el => el.isOnline).map(el => el.destinyUserInfo.membershipId);
        let arr_steam_id = await getAllMembersSteamID(arr_online_id);

        // 클랜 멤버 목록 정렬
        arr_members.sort((a, b) => {
            if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
            else if ((a.destinyUserInfo.membershipId in arr_steam_id) !== (b.destinyUserInfo.membershipId in arr_steam_id)) return (a.destinyUserInfo.membershipId in arr_steam_id) ? -1 : 1;
            else return a.destinyUserInfo.LastSeenDisplayName < b.destinyUserInfo.LastSeenDisplayName ? -1 : a.destinyUserInfo.LastSeenDisplayName > b.destinyUserInfo.LastSeenDisplayName ? 1: 0;
        });

        // 화면에 적용
        $user_el.forEach(($el, idx) => {
            let membership_id = arr_members[idx].destinyUserInfo.membershipId;
            let display_name = arr_members[idx].destinyUserInfo.LastSeenDisplayName;
            $el.children(".display-name").text(display_name).attr("title", display_name);

            if (arr_members[idx].isOnline) {
                // 온라인 + SteamID 정보 존재
                if (arr_steam_id[membership_id] !== undefined) {
                    $el.addClass("online").removeClass("error").children(".copy").attr("data-sid", arr_steam_id[membership_id]);
                }
                // 온라인 + SteamID 정보 없음
                else $el.addClass("error").removeClass("online").children(".copy").attr("data-sid", "");
            }
            // 오프라인
            else $el.removeClass("error online").children(".copy").attr("data-sid", "");
        });

        // 페이지 위치, 복사-합류 버튼 초기화
        setPage(0);
        if (mode === "direct") directJoinInitialize();
        else clipboardInitialize();
        // 완료 메시지
        $(".info-online").text(`${arr_online_id.length} / ${arr_members.length} 온라인`);
        $("#refresh").attr("data-icon", "done").attr("disabled", false);
    } catch (e) {
        console.log("error");
    } finally {
        // 업데이트 끝. 원상 복귀
        updateMembersEnd();
    }
}

const updateMembersStart = function () {
    $("#refresh").attr("disabled", true).data("icon", "hourglass_bottom");
    $(".user-list").addClass("loading");
}

const updateMembersEnd = function (isSuccess = true) {
    setTimeout(() => {$("#refresh").attr("data-icon", "refresh")}, 1000);
    $(".user-list").removeClass("loading");
}

const getAllMembersSteamID = async function (arr) {
    let r = {};
    let failList = [];
    arr.forEach(el => {
        let val = sessionStorage.getItem(el);
        if (val === null) failList.push(el);
        else r[el] = val;
    });
    if (failList.length === 0) return r;

    let newValues = await requestAllMembersSteamID(failList);
    Object.keys(newValues).forEach(el => {
        sessionStorage.setItem(el, newValues[el]);
        r[el] = newValues[el];
    });
    return r;
}

const requestAllMembersSteamID = async function (arr) {
    try {
        return await $.ajax({
            type: "GET",
            data: {id: arr},
            url: "/api/getSteamID",
            traditional: true
        });
    } catch {
        return {};
    }
}

const refreshMembers = async function() {
    await updateMembers(GROUP_ID);
}

// ================ /request ================ //
const _showClanContainer = function() {
    $(".clan-container").show()
    $(".error-msg-box").hide()
}
const _hideClanContainer = function() {
    $(".clan-container").hide()
    $(".error-msg-box").show().find("h2").text("검색 결과가 없습니다.")
}

const _editClanContainer = function(name, callsign, motto, count, group_id) {
    $(".clan-name").html(name);
    $(".clan-callsign").text(callsign);
    $(".clan-motto").text(motto);
    $(".clan-member-count").text(count + "명")
    $(".link-btn").attr("href", "https://www.bungie.net/ko/ClanV2?groupid=" + group_id)
    $(".request-btn").attr("data-groupId", group_id)
}

const getGroupByName = function(name) {
    _hideClanContainer();
    $(".error-msg-box h2").text("검색중...")
    $.ajax({
        type: "GET",
        url: "https://www.bungie.net/Platform/GroupV2/Name/" + name + "/1",
        headers: {
            "X-API-Key": API_KEY
        }
    }).done(function(data) {
        if (data.ErrorCode === 1) {
            _editClanContainer(
                data.Response.detail.name,
                data.Response.detail.clanInfo.clanCallsign,
                data.Response.detail.motto,
                data.Response.detail.memberCount,
                data.Response.detail.groupId
            );
            _showClanContainer();
            if (data.Response.detail.memberCount < 10) {
                $(".request-btn").attr("disabled", true);
            }
        }
        else {
            _hideClanContainer();
        }
    }).fail(function(data) {
        _hideClanContainer();
    });
}

const clanAddRequest = function(el) {
    let group_id = $(el).attr("data-groupId");
    $.ajax({
        type: "GET",
        url: "/api/clan/add/" + group_id
    }).done(function(resp) {
        if (resp.result) alert("신청이 완료되었습니다. 적용에는 시간이 걸리니 조금만 기다려주세요.");
        else alert("등록 신청 실패: " + resp.message);
    }).fail(function() {
        alert("등록 신청 실패.")
    });
}

const searchSubmit = function(e) {
    e.preventDefault();
    getGroupByName($("#clan-search").val())
}

// ================ /setting ================ //
// mode select
const getMode = function () {
    // windows 인 경우에는 기본값이 direct, 아닌 경우 copy
    let _mode = localStorage.getItem("mode");
    if (_mode) return _mode;
    else if (window.navigator.userAgent.toLowerCase().indexOf("windows") > -1) {
        console.log("it is windows");
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

// copy cmd lang setting
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
    if (cmd_lang.length > 0) {
        $("#cmd_join").val(cmd_join).attr("readonly", true);
        $("#cmd_invite").val(cmd_invite).attr("readonly", true);
        if (cmd_lang === "ko") $("input[name=lang][value=ko]").attr("checked", true);
        else if (cmd_lang === "en") $("input[name=lang][value=en]").attr("checked", true);
    }
    else {
        console.log("another")
        $("#cmd_join").val(cmd_join).removeAttr("readonly");
        $("#cmd_invite").val(cmd_invite).removeAttr("readonly");
        $("input[name=lang][value='']").attr("checked", true);
    }
}

const radioSetCmdPrefix = function (el) {
    setCommandPrefixByLang(el.value);
    $("#cmd_join").val(cmd_join).attr("readonly", true);
    $("#cmd_invite").val(cmd_invite).attr("readonly", true);
}

const textSetCmdPrefix = function () {
    cmd_join = $("#cmd_join").val();
    cmd_invite = $("#cmd_invite").val();
    cmd_lang = "";
    setCommandPrefix(cmd_join, cmd_invite, cmd_lang);
}

const enableCmdBox = function () {
    $("#cmd_join").removeAttr("readonly");
    $("#cmd_invite").removeAttr("readonly");
    cmd_lang = "";
    setCommandPrefix(cmd_join, cmd_invite, cmd_lang);
}

// ================ initializing ================ //
getCommandPrefix();
mode = getMode();
DOM_USER = mode === "direct" ? DOM_USER_DIRECT : DOM_USER_COPY;
