// ==UserScript==
// @name           AtCoder Listing Tasks
// @namespace      https://github.com/luuguas/AtCoderListingTasks
// @version        1.3
// @description    [問題]タブをクリックすると、各問題のページに移動できるドロップダウンリストを表示します。
// @description:en Click [Tasks] tab to open a drop-down list linked to each task.
// @author         luuguas
// @license        Apache-2.0
// @match          https://atcoder.jp/contests/*
// @exclude        https://atcoder.jp/contests/
// @exclude        https://atcoder.jp/contests/archive
// @grant          none
// ==/UserScript==

//AtCoderに標準で読み込まれているjQueryを使用
let $ = window.jQuery;

(function() {
    'use strict';
    const CONTEST_URL = 'https://atcoder.jp/contests/';
    const TAG_PREFIX = 'userscript-ACLT';
    const LIST_MAX_HEIGHT = '770%';
    const STYLES = {
        'dropdown': `max-height: ${LIST_MAX_HEIGHT}; overflow: visible auto;`,
        'label': `width: 100%; margin: 0px; padding: 3px 10px; clear: both; font-weight: normal; white-space: nowrap;`,
        'checkbox': `margin: 0px; vertical-align: middle;`,
    };
    const TEXTS = {
        'new_tab': {'ja': ' 新しいタブで開く', 'en': ' Open in a new tab'},
        'all_tasks': {'ja': ' 問題一覧', 'en': ' All Tasks'},
        'loading_failed': {'ja': '(読み込み失敗)', 'en': '(Loading Failed)'},
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
    
    /* ページの言語を取得する関数 */
    function getLanguage(){
        lang = 'ja';
        let content_language = $('meta[http-equiv="Content-Language"]');
        if(content_language.length !== 0 && content_language.attr('content') === 'en'){
            lang = 'en';
        }
    }
    let lang = 'ja';
    
    /* [問題]タブに本UserScript用のidを追加する関数(タブがなければfalseを返す) */
    function attachId(){
        let tabs = $('#contest-nav-tabs');
        if(tabs.length === 0){
            return false;
        }
        let tasks_tab = tabs.find('a[href$="tasks"]');
        if(tasks_tab.length === 0){
            return false;
        }
        else{
            tasks_tab.attr('id', `${TAG_PREFIX}-tab`);
            return true;
        }
    }
    
    /* [問題]タブを[提出結果]タブと同様のドロップダウンリストに変える関数 */
    function togglize(){
        let tasks_tab = $(`#${TAG_PREFIX}-tab`);
        tasks_tab.attr({
            'class': 'dropdown-toggle',
            'data-toggle': 'dropdown',
            'href': '#',
            'role': 'button',
            'aria-haspopup': 'true',
            'aria-expanded': 'false',
        });
        tasks_tab.append($('<span>', {class: 'caret'}));
        tasks_tab.parent().append($('<ul>', {class: 'dropdown-menu', style: STYLES['dropdown']}));
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
        let contest_name = location.href.split('/')[4];
        //contest_nameにハッシュ(#?)があれば取り除く
        let hash = contest_name.search(/[#\?]/);
        if(hash !== -1){
            contest_name = contest_name.slice(0, hash);
        }
        
        let dropdown_menu = $(`#${TAG_PREFIX}-tab`).parent().children('.dropdown-menu');

        /* [問題一覧]の追加 */
        let all_tasks = $('<a>', {href: `${CONTEST_URL}${contest_name}/tasks`});
        all_tasks.append($('<span>', {class: 'glyphicon glyphicon-list'}).attr('aria-hidden', 'true'));
        all_tasks.append(document.createTextNode(TEXTS['all_tasks'][lang]));
        //チェックボックスにチェックが付いていたら新しいタブで開く
        all_tasks.on('click', changeNewTabAttr);
        dropdown_menu.append($('<li>').append(all_tasks));
        
        /* [[✓]新しいタブで開く]の追加 */
        let label = $('<label>', {style: STYLES['label']});
        label.css('color', all_tasks.css('color')); //[問題一覧]から色情報を取得
        let checkbox = $('<input>', {type: 'checkbox', style: STYLES['checkbox']});
        //チェックボックスはチェック状態をストレージと同期
        setting.loadSetting();
        checkbox.prop('checked', setting.getValue('new_tab'));
        checkbox.on('click', function(){
            setting.setValue('new_tab', this.checked);
        });
        label.append(checkbox);
        label.append(document.createTextNode(TEXTS['new_tab'][lang]));
        dropdown_menu.prepend($('<li>').append(label));
        //チェックボックスが押された場合はドロップダウンリストを非表示にしない
        dropdown_menu.on('click', function(e){
            if(e.target === label[0]){
                e.stopPropagation();
            }
        });
        
        /* 分割線の追加 */
        dropdown_menu.append($('<li>', {class: 'divider'}));
        
        /* 各問題の追加 */
        // https://atcoder.jp/contests/.../tasks のページ情報をリクエスト
        let xhr = new XMLHttpRequest();
        xhr.responseType = 'document';
        xhr.onreadystatechange = function(){
            let dropdown_menu = $(`#${TAG_PREFIX}-tab`).parent().children('.dropdown-menu');
            
            if(xhr.readyState === 4){
                if(xhr.status === 200){
                    let result = $(xhr.responseXML);
                    let problem_node = result.find('#contest-nav-tabs + .col-sm-12');
                    let problem_list = problem_node.find('tbody tr');
                    
                    //表から問題情報を抽出
                    let list = [];
                    problem_list.each(function(){
                        let td = $(this).children('td');
                        list.push({
                            url: td[0].firstChild.getAttribute('href'),
                            diff: td[0].firstChild.textContent,
                            name: td[1].firstChild.textContent,
                        });
                    });
                    
                    //リストを追加
                    for(let data of list){
                        let a = $('<a>', {href: data.url, text: `${data.diff} - ${data.name}`});
                        //チェックボックスにチェックが付いていたら新しいタブで開く
                        a.on('click', changeNewTabAttr);
                        dropdown_menu.append($('<li>').append(a));
                    }
                    console.log('[AtCoder Listing Tasks] Succeeded!');
                }
                else{
                    //エラー情報を追加
                    let a = $('<a>', {href: '#', text: TEXTS['loading_failed'][lang]});
                    a.on('click', function(e){
                        e.preventDefault();
                    });
                    dropdown_menu.append($('<li>').append(a));
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
    getLanguage();
    togglize();
    addList();
    
})();
