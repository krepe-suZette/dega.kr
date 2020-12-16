var PAGE_CAPACITY = 0;
var MAX_PAGE = 0;
var CURRENT_PAGE = 0;
var API_KEY = "3632dd9656a54c6d90b31777940b2581";
var DOM_USER = $("<div class='user-wrap'><div class='user'><div class='emblem'></div><div class='display-name'></div><button class='copy material-icons' data-clipboard-text=''>content_copy</button></div></div>");
var GROUP_ID;

var clipboard;


// ================ /clan ================ //
var filterClanList = function(s) {
    // $(".clan-info").hide();
    var rows = $( ".clan-info" );
    rows.each(function() {
        if (this.innerText.indexOf(s) > -1) {
            $(this).show();
        }
        else {
            $(this).hide();
        }
    });
};

var _cmpNameASC = function (a, b) {return a.innerText > b.innerText ? 1 : -1;};
var _cmpNameDESC = function (a, b) {return a.innerText > b.innerText ? -1 : 1;};
var _cmpGroupIdASC = function(a, b) {
    var num_a = parseInt(/\/clan\/(\d+)/.exec(a.children[0].href)[1])
    var num_b = parseInt(/\/clan\/(\d+)/.exec(b.children[0].href)[1])
    return num_a - num_b;
};
var _cmpGroupIdDESC = function(a, b) {
    return -_cmpGroupIdASC(a, b);
};

var sortClanList = function(e) {
    var cmp = {"nameASC": _cmpNameASC, "nameDESC": _cmpNameDESC, "idASC": _cmpGroupIdASC, "idDESC": _cmpGroupIdDESC};
    $(".clan-list > li").sort(cmp[e.value]).appendTo(".clan-list")
};


// ================ /clan/<group_id> ================ //

var getMaxUserCount = function() {
    ww = $( window ).width();
    if (ww > 1440) c = 4;
    else if (ww > 960) c = 3;
    else if (ww > 640) c = 2;
    else c = 1;
    return parseInt($(".user-list").height() / 44) * c;
};


var setPage = function(p) {
    var page_count = getMaxUserCount();
    var total_user = $(".user").length;
    var max_page = Math.ceil(total_user / page_count) - 1;

    if (page_count == PAGE_CAPACITY && p == CURRENT_PAGE) return;
    
    if (p > max_page) p = 0;
    $(".user-wrap").each(function(index, element) {
        if (Math.floor(index / page_count) == p && $(element).hasClass("hide")) {
            $(element).removeClass("hide");
        }
        else if (Math.floor(index / page_count) != p && !$(element).hasClass("hide")) {
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
}

var nextPage = function() {
    if (MAX_PAGE < CURRENT_PAGE + 1) return;
    setPage(CURRENT_PAGE + 1);
}

var prevPage = function() {
    if (CURRENT_PAGE < 1) return;
    setPage(CURRENT_PAGE - 1);
}

var _setUserCount = function(n) {
    var total_user = $(".user").length;
    if (total_user == n) return;
    else if (total_user < n) {
        // 부족한 경우
        for(i=total_user; i<n; i++) $(".user-list").append(DOM_USER.clone());
    }
    else {
        $(`.user-wrap:gt(${n-1})`).remove();
    }
}

var _requestSteamIDs = function(arr) {
    var ret;
    $.ajax({
        type: "GET",
        data: {id: arr},
        url: "/api/getSteamID",
        async: false,
        traditional: true,
        success: function(data) {
            ret = data;
        }
    })
    return ret;
}

var getSteamIDs = function(arr) {
    // arr: [membershipId, ...]
    var r = {};
    var failList = [];
    arr.forEach(el => {
        var val = localStorage.getItem(el);
        if (val === null) failList.push(el);
        else r[el] = val;
    });

    if (failList.length == 0) return r;
    var newValues = _requestSteamIDs(failList);
    if (newValues === null) return r;

    Object.keys(newValues).forEach(el => {
        localStorage.setItem(el, newValues[el])
        r[el] = newValues[el];
    });
    return r;
}

var clipboardInitialize = function() {
    if (clipboard != null) clipboard.destroy();
    clipboard = new ClipboardJS('.copy');
    clipboard.on("success", function(e) {console.log("Copy Success")});
    clipboard.on("error", function(e) {console.log("COPY ERROR")});
}

var getClanOnlineMembers = function(groupId) {
    $("#refresh").attr("disabled", true).text("hourglass_bottom");
    GROUP_ID = groupId;
    $.ajax({
        url: "https://www.bungie.net/Platform/GroupV2/" + groupId + "/Members/",
        headers: {
            "X-API-Key": API_KEY
        }
    }).done(function(resp) {
        // 클랜 멤버 목록 전체 reload
        var arr_members = resp.Response.results.slice();
        var arr_online = arr_members.filter(m => m.isOnline);
        _setUserCount(arr_members.length);
        var arr_user_list = $(".user");

        // 00명 온라인 문구 수정
        $(".info-online").text(`${arr_online.length} / ${arr_members.length} 온라인`);
        
        // 온라인 멤버의 스팀ID 값을 불러오기
        var steamId = getSteamIDs(arr_online.map(el => el.destinyUserInfo.membershipId));
        // 클랜 멤버 목록 정렬
        arr_members.sort(function(a, b) {
            if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
            else if ((a.destinyUserInfo.membershipId in steamId) !== (b.destinyUserInfo.membershipId in steamId)) return (a.destinyUserInfo.membershipId in steamId) ? -1 : 1;
            else return a.destinyUserInfo.LastSeenDisplayName < b.destinyUserInfo.LastSeenDisplayName ? -1 : a.destinyUserInfo.LastSeenDisplayName > b.destinyUserInfo.LastSeenDisplayName ? 1: 0;
        });

        // 클랜 멤버를 실제 화면에 반영
        arr_members.forEach(function(element, idx) {
            $(arr_user_list[idx]).find(".display-name").html(element.destinyUserInfo.LastSeenDisplayName).attr("title", element.destinyUserInfo.LastSeenDisplayName);
            $(arr_user_list[idx]).removeClass("error");

            if (element.isOnline) {
                var sid = steamId[element.destinyUserInfo.membershipId];
                if (!sid) {
                    $(arr_user_list[idx]).removeClass("online");
                    $(arr_user_list[idx]).addClass("error");
                }
                else {
                    $(arr_user_list[idx]).addClass("online");
                    $(arr_user_list[idx]).children(".copy").attr("data-clipboard-text", "/합류 " + sid);
                }
            }
            else $(arr_user_list[idx]).removeClass("online");
        });

        arr_online.forEach(function(el, idx) {
            // 온라인 유저들에게 스팀id값 넣어주기
        });

        setPage(0);
        clipboardInitialize();
        $("#refresh").text("done").attr("disabled", false);
    }).fail(function () {
        $("#refresh").text("error_outline").attr("disabled", false);
    }).always(function() {
        setTimeout(() => {$("#refresh").text("refresh")}, 1000);
    });
}

var refreshMembers = function() {
    getClanOnlineMembers(GROUP_ID);
}

// ================ /request ================ //
var _showClanContainer = function() {
    $(".clan-container").show()
    $(".error-msg-box").hide()
}
var _hideClanContainer = function() {
    $(".clan-container").hide()
    $(".error-msg-box").show().find("h2").text("검색 결과가 없습니다.")
}

var _editClanContainer = function(name, callsign, motto, count, group_id) {
    $(".clan-name").text(name);
    $(".clan-callsign").text(callsign);
    $(".clan-motto").text(motto);
    $(".clan-member-count").text(count + "명")
    $(".link-btn").attr("href", "https://www.bungie.net/ko/ClanV2?groupid=" + group_id)
    $(".request-btn").attr("data-groupId", group_id)
}

var getGroupByName = function(name) {
    _hideClanContainer();
    $(".error-msg-box h2").text("검색중...")
    $.ajax({
        type: "GET",
        url: "https://www.bungie.net/Platform/GroupV2/Name/" + name + "/1",
        headers: {
            "X-API-Key": API_KEY
        }
    }).done(function(data) {
        if (data.ErrorCode == 1) {
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

var clanAddRequest = function(el) {
    var group_id = $(el).attr("data-groupId")
    $.ajax({
        type: "GET",
        url: "/api/clan/add/" + group_id
    }).done(function(resp) {
        if (resp.result) alert("신청이 완료되었습니다. 적용에는 시간이 걸리니 조금만 기다려주세요.");
        else alert("추가 신청 실패: " + resp.message);
    }).fail(function() {
        alert("추가 신청 실패.")
    });
}

var searchSubmit = function(e) {
    e.preventDefault();
    getGroupByName($("#clan-search").val())
}
