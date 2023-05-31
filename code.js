// ==UserScript==
// @name           AtCoder Listing Tasks
// @namespace      https://github.com/luuguas/AtCoderListingTasks
// @version        1.2
// @description    [問題]タブをクリックすると、各問題のページに移動できるドロップダウンリストを表示します。
// @description:en Click [Tasks] tab to open a drop-down list linked to each task.
// @author         luuguas
// @license        Apache-2.0
// @match          https://atcoder.jp/contests/*
// @exclude        https://atcoder.jp/contests/
// @exclude        https://atcoder.jp/contests/archive
// @grant          none
// ==/UserScript==

(function() {
    'use strict';
    const CONTEST_URL = 'https://atcoder.jp/contests/';
    const TAG_PREFIX = 'userscript-ACLT';
    const LIST_MAX_HEIGHT = '760%';
    const STYLES = {
        'dropdown': `max-height: ${LIST_MAX_HEIGHT}; overflow: visible auto;`,
        'label': `width: 100%; margin: 0px; padding: 3px 10px; clear: both; font-weight: normal; white-space: nowrap;`,
        'checkbox': `margin: 0px; vertical-align: middle;`,
    };

    /* 設定の読み込み・保存をするクラス */
    const SETTING_KEY = 'Setting_AtCoderListingTasks';
    let Setting = function(){
        this.data = {};
        this.default_data = {
            'new_tab': false,
        };
        this.storage = localStorage;
    };
    Setting.prototype = {
        loadSetting: function(){
            let value = this.storage[SETTING_KEY];
            if(value){
                this.data = JSON.parse(value);
            }
            else{
                this.storage[SETTING_KEY] = JSON.stringify(this.default_data);
                this.data = this.default_data;
            }
        },
        getValue: function(key){
            return this.data[key];
        },
        setValue: function(key, value){
            this.data[key] = value;
            this.storage[SETTING_KEY] = JSON.stringify(this.data);
        },
    };
    let setting = new Setting();

    /* ページの言語を取得 */
    let content_language = document.querySelector('meta[http-equiv="Content-Language"]');
    let lang = 'ja';
    if(content_language !== null && content_language.getAttribute('content') === 'en'){
        lang = 'en';
    }

    /* [問題]タブに本UserScript用のidを追加する関数(タブがなければfalseを返す) */
    function attachId(){
        let tabs = document.getElementById('contest-nav-tabs');
        if(tabs === null){
            return false;
        }
        let tasks_tab = tabs.querySelector('a[href$="tasks"]');
        if(tasks_tab === null){
            return false;
        }
        else{
            tasks_tab.id = `${TAG_PREFIX}-tab`;
            return true;
        }
    }

    /* [問題]タブを[提出結果]タブと同様のドロップダウンリストに変える関数 */
    function togglize(){
        let tasks_tab = document.getElementById(`${TAG_PREFIX}-tab`);
        let attr = {
            'class': 'dropdown-toggle',
            'data-toggle': 'dropdown',
            'href': '#',
            'role': 'button',
            'aria-haspopup': 'true',
            'aria-expanded': 'false',
        };
        for(let [key, value] of Object.entries(attr)){
            tasks_tab.setAttribute(key, value);
        }
        let caret = document.createElement('span');
        caret.className = 'caret';
        tasks_tab.appendChild(caret);

        let dropdown_menu = document.createElement('ul');
        dropdown_menu.className = `dropdown-menu`;
        tasks_tab.parentNode.appendChild(dropdown_menu);
    }

    /* [[✓]新しいタブで開く]のチェックの有無でaタグの属性を切り替える関数 */
    function changeNewTabAttr(e){
        let a = e.currentTarget;
        if(setting.getValue('new_tab')){
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
        }
        else{
            a.target = '_self';
            a.rel = '';
        }
    }

    /* リストを追加する関数 */
    function addList(){
        let url = location.href;
        let contest_name = url.split('/')[4];
        //contest_nameにハッシュ(#?)があれば取り除く
        let hash = contest_name.search(/[#\?]/);
        if(hash !== -1){
            contest_name = contest_name.slice(0, hash);
        }

        let tasks_tab_li = document.getElementById(`${TAG_PREFIX}-tab`).parentNode;
        let dropdown_menu = tasks_tab_li.querySelector('.dropdown-menu');

        /* [[✓]新しいタブで開く]の追加 */
        let new_tab = document.createElement('li');
        let label = document.createElement('label');
        label.style = STYLES['label'];

        let checkbox = document.createElement('input');
        checkbox.style = STYLES['checkbox'];
        checkbox.setAttribute('type', 'checkbox');
        //チェックボックスはチェック状態をストレージと同期
        setting.loadSetting();
        checkbox.checked = setting.getValue('new_tab');
        checkbox.addEventListener('click', function(){
            setting.setValue('new_tab', this.checked);
        });
        label.appendChild(checkbox);

        if(lang === 'ja'){
            label.appendChild(document.createTextNode(' 新しいタブで開く'));
        }
        else if(lang === 'en'){
            label.appendChild(document.createTextNode(' Open in a new tab'));
        }
        new_tab.appendChild(label);
        dropdown_menu.appendChild(new_tab);
        //チェックボックスが押された場合はドロップダウンリストを非表示にしない
        dropdown_menu.addEventListener('click', function(e){
            if(e.target === label){
                e.stopPropagation();
            }
        });

        /* [問題一覧]の追加 */
        let all_tasks = document.createElement('li');
        let a = document.createElement('a');
        a.href = `${CONTEST_URL}${contest_name}/tasks`;
        if(lang === 'ja'){
            a.innerHTML = `<span class="glyphicon glyphicon-list" aria-hidden="true"></span> 問題一覧`;
        }
        else if(lang === 'en'){
            a.innerHTML = `<span class="glyphicon glyphicon-list" aria-hidden="true"></span> All Tasks`;
        }

        //チェックボックスにチェックが付いていたら新しいタブで開く
        a.addEventListener('click', changeNewTabAttr);
        all_tasks.appendChild(a);
        dropdown_menu.appendChild(all_tasks);

        /* 分割線の追加 */
        let divider = document.createElement('li');
        divider.className = 'divider';
        dropdown_menu.appendChild(divider);

        /* 各問題の追加 */
        // https://atcoder.jp/contests/.../tasks のページ情報をリクエスト
        let xhr = new XMLHttpRequest();
        xhr.responseType = 'document';
        xhr.onreadystatechange = function(){
            let tasks_tab_li = document.getElementById(`${TAG_PREFIX}-tab`).parentNode;
            let dropdown_menu = tasks_tab_li.querySelector('.dropdown-menu');

            if(xhr.readyState === 4){
                if(xhr.status === 200){
                    let result = xhr.responseXML;
                    let problem_node = result.querySelector('#contest-nav-tabs + .col-sm-12');
                    let problem_list = problem_node.querySelectorAll('table.table tbody tr');

                    //表から問題情報を抽出
                    let list = [];
                    for(let li of problem_list){
                        let td = li.querySelectorAll('td');
                        let problem_url = td[0].firstChild.getAttribute('href');
                        let problem_diff = td[0].firstChild.textContent;
                        let problem_name = td[1].firstChild.textContent;
                        list.push({
                            url: problem_url,
                            diff: problem_diff,
                            name: problem_name,
                        });
                    }

                    //リストを追加
                    for(let data of list){
                        let li = document.createElement('li');
                        let a = document.createElement('a');
                        a.setAttribute('href', data.url);
                        a.textContent = `${data.diff} - ${data.name}`;
                        //チェックボックスにチェックが付いていたら新しいタブで開く
                        a.addEventListener('click', changeNewTabAttr);
                        li.appendChild(a);
                        dropdown_menu.appendChild(li);
                    }
                    console.log('[AtCoder Listing Tasks] Succeeded!');
                }
                else{
                    //エラー情報を追加
                    let li = document.createElement('li');
                    let a = document.createElement('a');
                    a.setAttribute('href', '#');
                    if(lang === 'ja'){
                        a.textContent = '(読み込み失敗)';
                    }
                    else if(lang === 'en'){
                        a.textContent = '(Loading Failed)';
                    }
                    a.addEventListener('click', function(e){
                        e.preventDefault();
                    });
                    li.appendChild(a);
                    dropdown_menu.appendChild(li);
                    console.log('[AtCoder Listing Tasks] Failed...');
                }
            }
        };
        xhr.open('GET', `${CONTEST_URL}${contest_name}/tasks`, true);
        xhr.send(null);
    }

    /* スクリプトを実行 */
    let tab_exist = attachId();
    //タブがない場合は終了
    if(!tab_exist){
        console.log('[AtCoder Listing Tasks] [Tasks] Tab isn\'t exist.');
        return;
    }
    togglize();
    addList();

})();
