// ==UserScript==
// @name           AtCoder Listing Tasks(Debug)
// @namespace      https://github.com/luuguas/AtCoderListingTasks
// @version        1.4
// @description    [問題]タブをクリックすると、各問題のページに移動できるドロップダウンリストを表示します。
// @description:en Click [Tasks] tab to open a drop-down list linked to each task.
// @author         luuguas
// @license        Apache-2.0
// @match          https://atcoder.jp/contests/*
// @exclude        https://atcoder.jp/contests/
// @exclude        https://atcoder.jp/contests/archive*
// @grant          none
// ==/UserScript==

(function () {
'use strict';

//AtCoderに標準で読み込まれているjQueryを使用
let $ = window.jQuery;

const CONTEST_URL = 'https://atcoder.jp/contests';
const ID_PREFIX = 'userscript-ACLT';
const PRE = 'ACLT';
const ATONCE_TAB_MAX = 20;
const CSS = `
.${PRE}-dropdown {
    max-height: 890%;
    overflow: visible auto;
}
.${PRE}-label {
    width: 100%;
    margin: 0px;
    padding: 3px 10px;
    clear: both;
    font-weight: normal;
    white-space: nowrap;
}
.${PRE}-checkbox {
    margin: 0px !important;
    vertical-align: middle;
}

.${PRE}-option {
    margin: 5px 0px 15px;
}
.${PRE}-flex {
    display: flex;
    align-items: center;
}
.${PRE}-select-all {
    height: 30px;
}
.${PRE}-select-specify {
    height: 35px;
}
.${PRE}-radio {
    padding: 0px 15px 0px 10px;
}
.${PRE}-disabled {
    opacity: 0.65; 
}
.${PRE}-caution {
    margin-left: 15px;
    color: red;
}
.${PRE}-toggle {
    min-width: 55px;
}
.${PRE}-caret {
    margin-left: 5px !important;
}
.${PRE}-list {
    max-height: 800%;
    overflow: visible auto;
}
.${PRE}-target {
    background-color: #e0e0e0;
}
.${PRE}-target:hover {
    background-color: #e0e0e0 !important;
}
.${PRE}-between {
    padding: 0px 5px;
}
`;
const TEXT = {
    newTab: { 'ja': '新しいタブで開く', 'en': 'Open in a new tab' },
    allTasks: { 'ja': '問題一覧', 'en': 'Task Table' },
    loadingFailed: { 'ja': '(読み込み失敗)', 'en': '(Loading Failed)' },
    atOnce: { 'ja': 'まとめて開く', 'en': 'Open at once' },
    modalDiscription: { 'ja': '複数の問題をまとめて開きます。', 'en': 'Open several tasks at once.' },
    cancel: { 'ja': 'キャンセル', 'en': 'Cancel' },
    all: { 'ja': 'すべて', 'en': 'All' },
    specify: { 'ja': '範囲を指定', 'en': 'Specify the range' },
    caution: { 'ja': `※一度に開くことのできるタブは ${ATONCE_TAB_MAX} 個までです。`, 'en': `*Up to ${ATONCE_TAB_MAX} tabs can be open at once.` },
    modalInfo: { 'ja': 'が開かれます。(ポップアップがブロックされた場合は許可してください。)', 'en': 'will be opened. (If pop-ups are blocked, please allow them.)' },
    aTab: { 'ja': '個のタブ', 'en': 'tab ' },
    tabs: { 'ja': '個のタブ', 'en': 'tabs ' },
};

const OLD_SETTING_KEY = 'Setting_AtCoderListingTasks';
const DB_NAME = 'UserScript_ACLT_Database';
const DB_VERSION = 1;
const STORE_NAME = { option: 'option', problemList: 'problemList' };
const STORE_INFO = [{ storeName: STORE_NAME.option, keyPath: 'name' }, { storeName: STORE_NAME.problemList, keyPath: 'contestName' }];

const REMOVE_INTERVAL = 1 * 60 * 60 * 1000;
const REMOVE_BASE = 10 * 24 * 60 * 60 * 1000;
const ACCESS_INTERVAL = 1 * 60 * 1000;

/*IndexedDBを扱うクラス
  https://github.com/luuguas/IndexedDBManager */
let IDBManager = function (databaseName) { this.database = null; this.databaseName = databaseName; };
IDBManager.prototype = {
    openDatabase(storeInfos, version) {
        return new Promise((resolve, reject) => {
            if (this.database !== null) { resolve(null); return; }
            if (typeof window.indexedDB === 'undefined') { reject('IndexedDB is not supported.'); return; }
            let openRequest = window.indexedDB.open(this.databaseName, version);
            openRequest.onupgradeneeded = (event) => {
                let database = event.target.result;
                let m = new Map();
                for (let name of database.objectStoreNames) m.set(name, { status: 1, keyPath: null });
                for (let info of storeInfos) {
                    if (m.get(info.storeName)) m.set(info.storeName, { status: 2, keyPath: info.keyPath });
                    else m.set(info.storeName, { status: 0, keyPath: info.keyPath });
                }
                for (let [name, info] of m) {
                    if (info.status === 0) database.createObjectStore(name, { keyPath: info.keyPath });
                    else if (info.status === 1) database.deleteObjectStore(name);
                }
                console.info('Database was created or upgraded.');
            };
            openRequest.onerror = (event) => { this.database = null; reject(`Failed to get database. (${event.target.error})`); };
            openRequest.onsuccess = (event) => { this.database = event.target.result; resolve(null); };
        });
    },
    isOpened() { return this.database !== null; },
    getData(storeName, key) {
        return new Promise((resolve, reject) => {
            if (!this.isOpened()) { reject('Database is not loaded.'); return; }
            let trans = this.database.transaction(storeName, 'readonly');
            let getRequest = trans.objectStore(storeName).get(key);
            getRequest.onerror = (event) => { reject(`Failed to get data. (${event.target.error})`); };
            getRequest.onsuccess = (event) => {
                if (event.target.result) resolve(event.target.result);
                else resolve(null);
            };
        });
    },
    getAllMatchedData(storeName, filter) {
        return new Promise((resolve, reject) => {
            if (!this.isOpened()) { reject('Database is not loaded.'); return; }
            let trans = this.database.transaction(storeName, 'readonly');
            let cursorRequest = trans.objectStore(storeName).openCursor();
            let res = [];
            cursorRequest.onerror = (event) => { reject(`Failed to get cursor. (${event.target.error})`); };
            cursorRequest.onsuccess = (event) => {
                let cursor = event.target.result;
                if (cursor) {
                    if (filter(cursor.value)) res.push(cursor.value);
                    cursor.continue();
                }
                else resolve(res);
            };
        });
    },
    setData(storeName, data) {
        return new Promise((resolve, reject) => {
            if (!this.isOpened()) { reject('Database is not loaded.'); return; }
            let trans = this.database.transaction(storeName, 'readwrite');
            let setRequest = trans.objectStore(storeName).put(data);
            setRequest.onerror = (event) => { reject(`Failed to set data. (${event.target.error})`); };
            setRequest.onsuccess = (event) => { resolve(null); };
        });
    },
    deleteData(storeName, key) {
        return new Promise((resolve, reject) => {
            if (!this.isOpened()) { reject('Database is not loaded.'); return; }
            let trans = this.database.transaction(storeName, 'readwrite');
            let deleteRequest = trans.objectStore(storeName).delete(key);
            deleteRequest.onerror = (event) => { reject(`Failed to delete data. (${event.target.error})`); };
            deleteRequest.onsuccess = (event) => { resolve(null); };
        });
    },
};

/* 設定や問題リストの読み込み・保存をするクラス */
let Setting = function () {
    this.newTab = null;
    this.problemList = null;
    this.atOnce = {
        begin: 0,
        end: 0,
    };
    this.lang = null;
    this.contestName = null;
    
    this.db = new IDBManager(DB_NAME);
    this.dbExists = false;
};
Setting.prototype = {
    openDB: async function () {
        try {
            await this.db.openDatabase(STORE_INFO, DB_VERSION);
        }
        catch (err) {
            console.error(err);
        }
        this.dbExists = this.db.isOpened();
    },
    requestList: function (contestName) {
        return new Promise((resolve, reject) => {
            let xhr = new XMLHttpRequest();
            xhr.responseType = 'document';
            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4) {
                    if (xhr.status === 200) {
                        let result = $(xhr.responseXML);
                        let problem_node = result.find('#contest-nav-tabs + .col-sm-12');
                        let problem_list = problem_node.find('tbody tr');
                        //問題リストを抽出して配列に格納
                        let list = [];
                        problem_list.each((idx, val) => {
                            let td = $(val).children('td');
                            list.push({
                                url: td[0].firstChild.getAttribute('href'),
                                diff: td[0].firstChild.textContent,
                                name: td[1].firstChild.textContent,
                            });
                        });
                        resolve(list);
                    }
                    else {
                        resolve(null);
                    }
                }
            };
            //https://atcoder.jp/contests/***/tasksのページ情報をリクエスト
            xhr.open('GET', `${CONTEST_URL}/${contestName}/tasks`, true);
            xhr.send(null);
        });
    },
    loadData: async function () {
        if (this.dbExists) {
            //データベースから情報を読み込む
            let resArray = await Promise.all([
                this.db.getData(STORE_NAME.problemList, this.contestName),
                this.db.getData(STORE_NAME.option, 'newTab'),
                this.db.getData(STORE_NAME.option, 'lastRemove')
            ]);
            let setTasks = [];
            let now = Date.now();
            //設定を格納
            if (resArray[1] !== null) {
                this.newTab = resArray[1].value;
            }
            else {
                this.newTab = false;
                setTasks.push(this.db.setData(STORE_NAME.option, { name: 'newTab', value: this.newTab }));
            }
            if (resArray[2] !== null) {
                this.lastRemove = resArray[2].value;
            }
            else {
                this.lastRemove = now;
                setTasks.push(this.db.setData(STORE_NAME.option, { name: 'lastRemove', value: this.lastRemove }));
            }
            //問題リストを格納
            if (resArray[0] !== null) {
                this.problemList = resArray[0].list;
                //lastAccessが現在時刻からACCESS_INTERVAL以上前なら更新する
                if (now - resArray[0].lastAccess >= ACCESS_INTERVAL) {
                    setTasks.push(this.db.setData(STORE_NAME.problemList, { contestName: this.contestName, list: this.problemList, lastAccess: now }));
                }
            }
            else {
                this.problemList = await this.requestList(this.contestName);
                if (this.problemList !== null) {
                    setTasks.push(this.db.setData(STORE_NAME.problemList, { contestName: this.contestName, list: this.problemList, lastAccess: now }));
                }
            }
            this.atOnce.begin = 0;
            this.atOnce.end = Math.min(ATONCE_TAB_MAX - 1, this.problemList.length - 1);
            
            //情報を更新
            await Promise.all(setTasks);
        }
        else {
            this.newTab = false;
            this.problemList = await this.requestList(this.contestName);
        }
    },
    saveData: async function (name, value) {
        await this.db.setData(STORE_NAME.option, { name, value });
    },
    removeOldData: async function () {
        let now = Date.now();
        if (!this.dbExists) {
            return;
        }
        if (now - this.lastRemove < REMOVE_INTERVAL) {
            return;
        }
        //最終アクセスが現在時刻より一定以上前の問題リストを削除する
        let oldData = await this.db.getAllMatchedData(STORE_NAME.problemList, (data) => {return now - data.lastAccess >= REMOVE_BASE; });
        if (oldData.length !== 0) {
            let deleteTasks = [];
            for (let data of oldData) {
                deleteTasks.push(this.db.deleteData(STORE_NAME.problemList, data.contestName));
            }
            await Promise.all(deleteTasks);
        }
        //lastRemoveを更新する
        this.lastRemove = now;
        await this.db.setData(STORE_NAME.option, { name: 'lastRemove', value: this.lastRemove });
    },
    
    getLanguage: function () {
        this.lang = 'ja';
        let content_language = $('meta[http-equiv="Content-Language"]');
        if (content_language.length !== 0 && content_language.attr('content') === 'en') {
            this.lang = 'en';
        }
    },
    getContestName: function () {
        this.contestName = window.location.href.split('/')[4];
        //ハッシュ(#?)があれば取り除く
        let hash = this.contestName.search(/[#\?]/);
        if (hash !== -1) {
            this.contestName = this.contestName.slice(0, hash);
        }
    },
};

/* DOM操作およびスクリプト全体の動作を管理するクラス */
let Launcher = function () {
    this.setting = new Setting();
    this.dropdownList = {
        begin: null,
        end: null,
    };
    this.listChanged = {
        begin: true,
        end: true,
    };
    this.isAll = true;
};
Launcher.prototype = {
    loadSetting: async function () {
        this.setting.getContestName();
        await this.setting.openDB();
        await this.setting.loadData();
    },
    attachId: function () {
        let tabs = $('#contest-nav-tabs');
        if (tabs.length === 0) {
            return false;
        }
        let tasks_tab = tabs.find('a[href$="tasks"]');
        if (tasks_tab.length === 0) {
            return false;
        }
        else{
            tasks_tab.attr('id', `${ID_PREFIX}-tab`);
            return true;
        }
    },
    addCss: function () {
        let style = $('<style>', { id: `${ID_PREFIX}-style`, html: CSS });
        $('head').append(style);
    },
    changeToDropdown: function () {
        let tasks_tab = $(`#${ID_PREFIX}-tab`);
        tasks_tab.attr({
            'class': 'dropdown-toggle',
            'data-toggle': 'dropdown',
            'href': '#',
            'role': 'button',
            'aria-haspopup': 'true',
            'aria-expanded': 'false',
        });
        tasks_tab.append($('<span>', { class: 'caret' }));
        tasks_tab.parent().append($('<ul>', { class: `dropdown-menu ${PRE}-dropdown` }));
    },
    addList: function () {
        let dropdown_menu = $(`#${ID_PREFIX}-tab`).parent().children('.dropdown-menu');
    
        /* [問題一覧]の追加 */
        let all_tasks = $('<a>', { href: `${CONTEST_URL}/${this.setting.contestName}/tasks` });
        all_tasks.append($('<span>', { class: 'glyphicon glyphicon-list' }).attr('aria-hidden', 'true'));
        all_tasks.append(document.createTextNode(' ' + TEXT.allTasks[this.setting.lang]));
        //チェックボックスにチェックが付いていたら新しいタブで開く
        all_tasks[0].addEventListener('click', { handleEvent: this.changeNewTabAttr, setting: this.setting });
        dropdown_menu.append($('<li>').append(all_tasks));
        
        /* [まとめて開く]の追加 */
        if (this.setting.problemList !== null) {
            let at_once = $('<a>');
            at_once.append($('<span>', { class: 'glyphicon glyphicon-sort-by-attributes-alt' }).attr('aria-hidden', 'true'));
            at_once.append(document.createTextNode(' ' + TEXT.atOnce[this.setting.lang] + '...'));
            at_once[0].addEventListener('click', (e) => {
                $(`#${ID_PREFIX}-modal`).modal('show');
            });
            dropdown_menu.append($('<li>').append(at_once));
        }
        
        /* [新しいタブで開く]の追加 */
        let label = $('<label>', { class: `${PRE}-label` });
        label.css('color', all_tasks.css('color')); //[問題一覧]から色情報を取得
        let checkbox = $('<input>', { type: 'checkbox', class: `${PRE}-checkbox` });
        //チェックボックスはチェック状態をストレージと同期
        checkbox.prop('checked', this.setting.newTab);
        checkbox.on('click', (e) => {
            this.setting.newTab = e.currentTarget.checked;
            if (this.setting.dbExists) {
                this.setting.saveData('newTab', this.setting.newTab);
            }
        });
        label.append(checkbox);
        label.append(document.createTextNode(' ' + TEXT.newTab[this.setting.lang]));
        dropdown_menu.prepend($('<li>').append(label));
        //チェックボックスが押された場合はドロップダウンリストを非表示にしない
        dropdown_menu.on('click', (e) => {
            if (e.target === label[0]) {
                e.stopPropagation();
            }
        });
        
        /* 分割線の追加 */
        dropdown_menu.append($('<li>', { class: 'divider' }));
        
        /* 各問題の追加 */
        if (this.setting.problemList !== null) {
            //リストを追加
            for (let data of this.setting.problemList) {
                let a = $('<a>', { href: data.url, text: `${data.diff} - ${data.name}` });
                //チェックボックスにチェックが付いていたら新しいタブで開く
                a[0].addEventListener('click', { handleEvent: this.changeNewTabAttr, setting: this.setting });
                dropdown_menu.append($('<li>').append(a));
            }
            console.log('[AtCoder Listing Tasks] Succeeded!');
        }
        else {
            //エラー情報を追加
            let a = $('<a>', { text: TEXT.loadingFailed[this.setting.lang] });
            dropdown_menu.append($('<li>').append(a));
            console.log('[AtCoder Listing Tasks] Failed...');
        }
    },
    changeNewTabAttr: function (e) {
        let a = e.currentTarget;
        if (this.setting.newTab) {
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
        }
        else {
            a.target = '_self';
            a.rel = '';
        }
    },
    
    addModal: function () {
        let modal = $('<div>', { id: `${ID_PREFIX}-modal`, class: 'modal fade', tabindex: '-1', role: 'dialog' });
        
        /* header */
        let header = $('<div>', { class: 'modal-header' });
        let x = $('<button>', { type: 'button', class: 'close', 'data-dismiss': 'modal', 'aria-label': 'Close' });
        x.append($('<span>', { 'aria-hidden': true, text: '×' }));
        header.append(x);
        header.append($('<h4>', { class: 'modal-title', text: TEXT.atOnce[this.setting.lang] }));
        
        /* body */
        let body = $('<div>', { class: 'modal-body' });
        body.append($('<p>', { text: TEXT.modalDiscription[this.setting.lang] }));
        let modalInfo = $('<p>');
        
        //ラジオボタン
        let option = $('<div>', { class: `${PRE}-option` });
        let all = $('<div>', { class: `${PRE}-flex ${PRE}-select-all` });
        let specify = $('<div>', { class: `${PRE}-flex ${PRE}-select-specify` });
        let label_all = $('<label>', { class: `${PRE}-label-radio` });
        let radio_all = $('<input>', { type: 'radio', name: 'open-type' });
        let label_specify = label_all.clone(true);
        let radio_specify = radio_all.clone(true);
        
        if (this.setting.atOnce.begin === 0 && this.setting.atOnce.end === this.setting.problemList.length - 1) {
            this.isAll = true;
        }
        else {
            this.isAll = false;
        }
        radio_all.prop('checked', this.isAll);
        radio_specify.prop('checked', !this.isAll);
        label_all.append(radio_all, document.createTextNode(TEXT.all[this.setting.lang]));
        label_specify.append(radio_specify, document.createTextNode(TEXT.specify[this.setting.lang] + ':'));
        let caution = $('<span>', { class: `${PRE}-caution` });
        if (this.setting.problemList.length > ATONCE_TAB_MAX) {
            radio_all.prop('disabled', true);
            label_all.addClass(`${PRE}-disabled`);
            caution.text(TEXT.caution[this.setting.lang]);
        }
        all.append($('<div>', { class: `radio ${PRE}-radio` }).append(label_all, caution));
        specify.append($('<div>', { class: `radio ${PRE}-radio` }).append(label_specify));
        
        //[範囲を選択]用のドロップダウン
        let select_begin = $('<div>', { class: `btn-group` });
        let begin_button = $('<button>', { class: `btn btn-default dropdown-toggle ${PRE}-toggle`, 'data-toggle': 'dropdown', 'aria-expanded': 'false', text: 'A', disabled: this.isAll });
        begin_button.append($('<span>', { class: `caret ${PRE}-caret` }));        
        let begin_list = $('<ul>', { class: `dropdown-menu ${PRE}-list` });
        $.each(this.setting.problemList, (idx, data) => {
            begin_list.append($('<li>').append($('<a>', { text: `${data.diff} - ${data.name}`, 'data-index': (idx).toString() })));
        });
        select_begin.append(begin_button, begin_list);
        
        let select_end = select_begin.clone(true);
        let end_list = select_end.find('ul');
        let end_button = select_end.find('button');
        let between = $('<span>', { text: '−', class: `${PRE}-between` });
        
        //初期表示の設定
        begin_button.html(`${this.setting.problemList[this.setting.atOnce.begin].diff}<span class="caret ${PRE}-caret"></span>`);
        end_button.html(`${this.setting.problemList[this.setting.atOnce.end].diff}<span class="caret ${PRE}-caret"></span>`);
        this.dropdownList.begin = begin_list.find('a');
        this.dropdownList.end = end_list.find('a');
        this.dropdownList.begin.eq(this.setting.atOnce.begin).addClass(`${PRE}-target`);
        this.dropdownList.end.eq(this.setting.atOnce.end).addClass(`${PRE}-target`);
        this.setModalInfo(modalInfo, this.setting, this.isAll);
        
        //ラジオボタンを切り替えたときの動作
        radio_all.on('change', (e) => {
            this.isAll = true;
            begin_button.prop('disabled', true);
            end_button.prop('disabled', true);
            between.addClass(`${PRE}-disabled`);
            this.setModalInfo(modalInfo, this.setting, this.isAll);
        });
        radio_specify.on('change', (e) => {
            this.isAll = false;
            begin_button.prop('disabled', false);
            end_button.prop('disabled', false);
            between.removeClass(`${PRE}-disabled`);
            this.setModalInfo(modalInfo, this.setting, this.isAll);
        });
        
        //リストを開いたときの動作
        select_begin.on('shown.bs.dropdown', (e) => {
            if (this.listChanged.begin) {
                begin_list.scrollTop(26 * (this.setting.atOnce.begin - 2));
                this.listChanged.begin = false;
            }
        });
        select_end.on('shown.bs.dropdown', (e) => {
            if (this.listChanged.end) {
                end_list.scrollTop(26 * (this.setting.atOnce.end - 2));
                this.listChanged.end = false;
            }
        });
        
        //リストで選択したときの動作
        begin_list[0].addEventListener('click', { handleEvent: this.changeRange, that: this, begin_button, end_button, modalInfo, isBegin: true });
        end_list[0].addEventListener('click', { handleEvent: this.changeRange, that: this, begin_button, end_button, modalInfo, isBegin: false });
        
        //組み立て
        specify.append(select_begin, between, select_end);
        option.append(all, specify);
        body.append(option);
        body.append(modalInfo);
        
        /* footer */
        let footer = $('<div>', { class: 'modal-footer' });
        let cancel = $('<button>', { type: 'button', class: 'btn btn-default', 'data-dismiss': 'modal', text: TEXT.cancel[this.setting.lang] });
        let open = $('<button>', { type: 'button', class: 'btn btn-primary', text: TEXT.atOnce[this.setting.lang] });
        open.on('click', (e) => {
            let blank = window.open('about:blank'); //ポップアップブロック用
            let idx = null;
            if (this.isAll) {
                idx = this.setting.problemList.length - 1;
                while (idx >= 0) {
                    window.open(this.setting.problemList[idx].url, '_blank', 'popup, noopener, noreferrer');
                    --idx;
                }
            }
            else {
                idx = this.setting.atOnce.end;
                while (idx >= this.setting.atOnce.begin) {
                    window.open(this.setting.problemList[idx].url, '_blank', 'popup, noopener, noreferrer');
                    --idx;
                }
            }
            modal.modal('hide');
            blank.close();
        });
        footer.append(cancel, open);
        
        /* モーダルウィンドウを追加 */
        let dialog = $('<div>', { class: 'modal-dialog', role: 'document' });
        let content = $('<div>', { class: 'modal-content' });
        content.append(header, body, footer);
        modal.append(dialog.append(content));
        $('#main-div').before(modal);
    },
    changeRange: function (e) {
        if (e.target.tagName !== 'A') {
            return;
        }
        let atOnce = this.that.setting.atOnce;
        let idx = Number($(e.target).attr('data-index'));
        if (this.isBegin) {
            this.that.changeSelect(this.that, this.begin_button, idx, true);
            if (atOnce.end < atOnce.begin) {
                this.that.changeSelect(this.that, this.end_button, idx, false);
            }
            else if (atOnce.end >= atOnce.begin + ATONCE_TAB_MAX) {
                this.that.changeSelect(this.that, this.end_button, idx + ATONCE_TAB_MAX - 1, false);
            }
        }
        else {
            this.that.changeSelect(this.that, this.end_button, idx, false);
            if (atOnce.begin > atOnce.end) {
                this.that.changeSelect(this.that, this.begin_button, idx, true);
            }
            if (atOnce.begin <= atOnce.end - ATONCE_TAB_MAX) {
                this.that.changeSelect(this.that, this.begin_button, idx - ATONCE_TAB_MAX + 1, true);
            }
        }
        this.that.setModalInfo(this.modalInfo, this.that.setting, this.that.isAll);
    },
    changeSelect: function (that, button, idx, isBegin) {
        let problemList = that.setting.problemList;
        let atOnce = that.setting.atOnce;
        let dropdownList = that.dropdownList;
        if (isBegin) {
            dropdownList.begin.eq(atOnce.begin).removeClass(`${PRE}-target`);
            atOnce.begin = idx;
            dropdownList.begin.eq(idx).addClass(`${PRE}-target`);
            that.listChanged.begin = true;
        }
        else {
            dropdownList.end.eq(atOnce.end).removeClass(`${PRE}-target`);
            atOnce.end = idx;
            dropdownList.end.eq(idx).addClass(`${PRE}-target`);
            that.listChanged.end = true;
        }
        button.html(`${problemList[idx].diff}<span class="caret ${PRE}-caret"></span>`);
    },
    setModalInfo: function (modalInfo, setting, isAll) {
        let text = '';
        if (isAll) {
            text += (setting.problemList.length).toString();
            text += ' ';
            if (setting.problemList.length === 1) {
                text += TEXT.aTab[setting.lang];
            }
            else {
                text += TEXT.tabs[setting.lang];
            }
        }
        else {
            text += (setting.atOnce.end - setting.atOnce.begin + 1).toString();
            text += ' ';
            if (setting.atOnce.end === setting.atOnce.begin) {
                text += TEXT.aTab[setting.lang];
            }
            else {
                text += TEXT.tabs[setting.lang];
            }
        }
        text += TEXT.modalInfo[setting.lang];
        modalInfo.text(text);
    },
    
    
    launch: async function () {
        let tabExists = this.attachId();
        //タブがない場合は終了
        if (!tabExists) {
            console.log('[AtCoder Listing Tasks] [Tasks] Tab isn\'t exist.');
            return;
        }
        
        await this.loadSetting();
        this.setting.getLanguage();
        this.addCss();
        this.changeToDropdown();
        this.addList();
        
        this.addModal();
        
        window.localStorage.removeItem(OLD_SETTING_KEY);
        await this.setting.removeOldData();
    },
};

/* スクリプトを実行 */
let launcher = new Launcher();
launcher.launch();

})();
