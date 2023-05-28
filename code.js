// ==UserScript==
// @name         AtCoder Listing Tasks
// @namespace    https://github.com/luuguas/AtCoderListingTasks
// @version      1.0
// @description  Click [Tasks] tab to open a drop-down list linked to each task. / [問題]タブをクリックすると、各問題のページに移動できるドロップダウンリストを表示します。
// @author       luuguas
// @license      Apache-2.0
// @match        https://atcoder.jp/contests/*
// @exclude      https://atcoder.jp/contests/
// @exclude      https://atcoder.jp/contests/archive
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    const contest_url = 'https://atcoder.jp/contests/';
    const unique_tag = 'user-script-listing-tasks';

    //[問題]タブに本UserScript用のidを追加(タブがなければfalseを返す)
    function AttachId(){
        let tabs = document.getElementById('contest-nav-tabs');
        if(tabs === null){
            return false;
        }
        let tasks_tab = tabs.querySelector('a[href$="tasks"]');
        if(tasks_tab === null){
            return false;
        }
        else{
            tasks_tab.setAttribute('id', unique_tag);
            return true;
        }
    }

    //[提出結果]タブと同様のドロップダウンリストに変える(中身は空)
    function Togglize(){
        let tasks_tab = document.getElementById(unique_tag);

        let attr = {
            'class': 'dropdown-toggle',
            'data-toggle': 'dropdown',
            'href': '#',
            'role:': 'button',
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
        dropdown_menu.className = 'dropdown-menu';
        tasks_tab.parentNode.appendChild(dropdown_menu);
    }

    //リストを追加する
    function AddList(){
        let url = location.href;
        let contest_name = url.split('/')[4];
        let hash = contest_name.search(/[#\?]/);
        if(hash !== -1){
            //ハッシュ(#,?)を除く
            contest_name = contest_name.slice(0, hash);
        }

        let tasks_tab_li = document.getElementById(unique_tag).parentNode;
        let dropdown_menu = tasks_tab_li.querySelector('.dropdown-menu');

        //[問題一覧]の追加
        let all_tasks = document.createElement('li');
        let lang = document.querySelector('meta[http-equiv="Content-Language"]');
        if(lang !== null && lang.getAttribute('content') === 'en'){
            all_tasks.innerHTML = '<a href="' + contest_url + contest_name + '/tasks"><span class="glyphicon glyphicon-list" aria-hidden="true"></span> All Tasks</a>';
        }
        else{
            all_tasks.innerHTML = '<a href="' + contest_url + contest_name + '/tasks"><span class="glyphicon glyphicon-list" aria-hidden="true"></span> 問題一覧</a>';
        }
        dropdown_menu.appendChild(all_tasks);

        //分割線の追加
        let divider = document.createElement('li');
        divider.className = 'divider';
        dropdown_menu.appendChild(divider);

        //https://atcoder.jp/contests/***/tasks から問題のリストを抽出
        let xhr = new XMLHttpRequest();
        xhr.responseType = 'document';
        xhr.onreadystatechange = function(){
            let tasks_tab_li = document.getElementById(unique_tag).parentNode;
            let dropdown_menu = tasks_tab_li.querySelector('.dropdown-menu');

            if(xhr.readyState === 4){
                if(xhr.status === 200){
                    let result = xhr.responseXML;
                    let problem_node = result.querySelector('#contest-nav-tabs + .col-sm-12');
                    let problem_list = problem_node.querySelectorAll('table.table tbody tr');

                    //問題情報を抽出
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
                        a.textContent = data.diff + ' - ' + data.name;
                        li.appendChild(a);
                        dropdown_menu.appendChild(li);
                    }
                    console.log('[AtCoder Listing Tasks] Succeeded!');
                }
                else{
                    let li = document.createElement('li');
                    let a = document.createElement('a');
                    a.setAttribute('href', 'javascript:void(0)');
                    a.textContent = '(読み込み失敗)';
                    li.appendChild(a);
                    dropdown_menu.appendChild(li);
                    console.log('[AtCoder Listing Tasks] Failed...');
                }
            }
        };
        xhr.open('GET', 'https://atcoder.jp/contests/' + contest_name + '/tasks', true);
        xhr.send(null);
    }

    let tab_exist = AttachId();
    if(!tab_exist){
        //タブがない場合は終了
        console.log('[AtCoder Listing Tasks] [Tasks] Tab isn\'t exist.');
        return;
    }
    Togglize();
    AddList();

})();
