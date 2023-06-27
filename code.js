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
// @exclude        https://atcoder.jp/contests/archive
// @grant          none
// ==/UserScript==

(function () {
'use strict';

//AtCoderに標準で読み込まれているjQueryを使用
let $ = window.jQuery;

const CONTEST_URL = 'https://atcoder.jp/contests';
const TAG_PREFIX = 'Userscript-ACLT';
const LIST_MAX_HEIGHT = '770%';
const STYLE = {
    dropdown: `max-height: ${LIST_MAX_HEIGHT}; overflow: visible auto;`,
    label: 'width: 100%; margin: 0px; padding: 3px 10px; clear: both; font-weight: normal; white-space: nowrap;',
    checkbox: 'margin: 0px; vertical-align: middle;',
    option: 'margin: 5px 0px 15px;',
    flex: 'display: flex; align-items: center;',
    all: 'height: 30px;',
    specify: 'height: 35px',
    ratioContainer: 'padding: 0px 15px 0px 10px;',
    caret: 'margin-left: 5px;',
    between: 'padding: 0px 5px;',
};
const TEXT = {
    newTab: { 'ja': '新しいタブで開く', 'en': 'Open in a new tab' },
    allTasks: { 'ja': '問題一覧', 'en': 'Task Table' },
    loadingFailed: { 'ja': '(読み込み失敗)', 'en': '(Loading Failed)' },
    atOnce: { 'ja': 'まとめて開く', 'en': 'Open at once' },
    modalDiscription: { 'ja': '複数の問題をまとめて開きます。', 'en': 'Open several tasks at once.' },
    cancel: { 'ja': 'キャンセル', 'en': 'Cancel' },
    all: { 'ja': 'すべて', 'en': 'All' },
    specify: { 'ja': '範囲を指定', 'en': 'Specify the range' },
    modalInfo: { 'ja': 'が開かれます。(ポップアップがブロックされた場合は許可してください。)', 'en': 'will be opened. (If pop-ups are blocked, please allow them.)' },
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

/* スクリプト全体の動作を管理するクラス */
let Launcher = function () {
    this.setting = new Setting();
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
            tasks_tab.attr('id', `${TAG_PREFIX}-tab`);
            return true;
        }
    },
    changeToDropdown: function () {
        let tasks_tab = $(`#${TAG_PREFIX}-tab`);
        tasks_tab.attr({
            'class': 'dropdown-toggle',
            'data-toggle': 'dropdown',
            'href': '#',
            'role': 'button',
            'aria-haspopup': 'true',
            'aria-expanded': 'false',
        });
        tasks_tab.append($('<span>', { class: 'caret' }));
        tasks_tab.parent().append($('<ul>', { class: 'dropdown-menu', style: STYLE.dropdown }));
    },
    addList: function () {
        let dropdown_menu = $(`#${TAG_PREFIX}-tab`).parent().children('.dropdown-menu');
    
        /* [問題一覧]の追加 */
        let all_tasks = $('<a>', { href: `${CONTEST_URL}/${this.setting.contestName}/tasks` });
        all_tasks.append($('<span>', { class: 'glyphicon glyphicon-list' }).attr('aria-hidden', 'true'));
        all_tasks.append(document.createTextNode(' ' + TEXT.allTasks[this.setting.lang]));
        //チェックボックスにチェックが付いていたら新しいタブで開く
        all_tasks[0].addEventListener('click', { handleEvent: this.changeNewTabAttr, that: this });
        dropdown_menu.append($('<li>').append(all_tasks));
        
        /* [まとめて開く]の追加 */
        if (this.setting.problemList !== null) {
            let at_once = $('<a>', { href: '#' });
            at_once.append($('<span>', { class: 'glyphicon glyphicon-sort-by-attributes-alt' }).attr('aria-hidden', 'true'));
            at_once.append(document.createTextNode(' ' + TEXT.atOnce[this.setting.lang] + '...'));
            at_once[0].addEventListener('click', (e) => {
                $(`#${TAG_PREFIX}-modal`).modal('show');
                e.preventDefault();
            });
            dropdown_menu.append($('<li>').append(at_once));
        }
        
        /* [[✓]新しいタブで開く]の追加 */
        let label = $('<label>', { style: STYLE.label });
        label.css('color', all_tasks.css('color')); //[問題一覧]から色情報を取得
        let checkbox = $('<input>', { type: 'checkbox', style: STYLE.checkbox });
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
                a[0].addEventListener('click', { handleEvent: this.changeNewTabAttr, that: this });
                dropdown_menu.append($('<li>').append(a));
            }
            console.log('[AtCoder Listing Tasks] Succeeded!');
        }
        else {
            //エラー情報を追加
            let a = $('<a>', { href: '#', text: TEXT.loadingFailed[this.setting.lang] });
            a.on('click', (e) => {
                e.preventDefault();
            });
            dropdown_menu.append($('<li>').append(a));
            console.log('[AtCoder Listing Tasks] Failed...');
        }
    },
    changeNewTabAttr: function (e) {
        let a = e.currentTarget;
        if (this.that.setting.newTab) {
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
        }
        else {
            a.target = '_self';
            a.rel = '';
        }
    },
    
    addModal: function () {
        let modal = $('<div>', { id: `${TAG_PREFIX}-modal`, class: 'modal fade', tabindex: '-1', role: 'dialog' });
        
        //header
        let header = $('<div>', { class: 'modal-header' });
        let x = $('<button>', { type: 'button', class: 'close', 'data-dismiss': 'modal', 'aria-label': 'Close' });
        x.append($('<span>', { 'aria-hidden': true, text: '×' }));
        header.append(x);
        header.append($('<h4>', { class: 'modal-title', text: TEXT.atOnce[this.setting.lang] }));
        
        //body
        let body = $('<div>', { class: 'modal-body' });
        body.append($('<p>', { text: TEXT.modalDiscription[this.setting.lang] }));
        
        let option = $('<div>', { style: STYLE.option });
        let all = $('<div>', { style: STYLE.flex + STYLE.all });
        let specify = $('<div>', { style: STYLE.flex + STYLE.specify });
        let label_all = $('<label>');
        let ratio_all = $('<input>', { type: 'radio', name: 'open-type' });
        let label_specify = label_all.clone(true);
        let ratio_specify = ratio_all.clone(true);
        
        ratio_all.prop('checked', true);
        label_all.append(ratio_all, document.createTextNode(TEXT.all[this.setting.lang]));
        label_specify.append(ratio_specify, document.createTextNode(TEXT.specify[this.setting.lang] + ':'));
        all.append($('<div>', { class: 'radio', style: STYLE.ratioContainer }).append(label_all));
        specify.append($('<div>', { class: 'radio', style: STYLE.ratioContainer }).append(label_specify));
        
        let select_begin = $('<div>', { class: 'btn-group' });
        let begin_button = $('<button>', { text: 'A', class: 'btn btn-default dropdown-toggle', 'data-toggle': 'dropdown', 'aria-expanded': 'false' });
        begin_button.append($('<span>', { class: 'caret', style: STYLE.caret }));
        let begin_list = $('<ul>', { class: 'dropdown-menu' });
        for (let data of this.setting.problemList) {
            begin_list.append($('<li>').append($('<a>', { text: `${data.diff} - ${data.name}`, class: 'dropdown-item', href: '#' })));
        }
        select_begin.append(begin_button, begin_list);
        let select_end = select_begin.clone(true);
        specify.append(select_begin, $('<span>', { text: '−', style: STYLE.between }), select_end);
        
        option.append(all, specify);
        body.append(option);
        body.append($('<p>', { text: '20 個のタブ' + TEXT.modalInfo[this.setting.lang] }));
        
        //footer
        let footer = $('<div>', { class: 'modal-footer' });
        let cancel = $('<button>', { type: 'button', class: 'btn btn-default', 'data-dismiss': 'modal', text: TEXT.cancel[this.setting.lang] });
        let open = $('<button>', { type: 'button', class: 'btn btn-primary', text: TEXT.atOnce[this.setting.lang] });
        footer.append(cancel, open);
        
        //モーダルウィンドウを追加
        let dialog = $('<div>', { class: 'modal-dialog', role: 'document' });
        let content = $('<div>', { class: 'modal-content' });
        content.append(header, body, footer);
        modal.append(dialog.append(content));
        $('#main-div').before(modal);
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
