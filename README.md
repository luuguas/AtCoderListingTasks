言語: 日本語 | [English](https://github.com/luuguas/AtCoderListingTasks/blob/main/README_en.md)

# 概要
AtCoderのコンテストページで「問題」タブをクリックすると、コンテスト内の各問題のページに移動できるドロップダウンリストを表示します。

# インストール
1. [Tampermonkey](https://www.tampermonkey.net) をインストールしていない場合はインストールしてください。
2. [AtCoder Listing Tasks - Greasy Fork](https://greasyfork.org/ja/scripts/467289-atcoder-listing-tasks) のサイトで「スクリプトをインストール」を押し、確認画面に移ったらもう一度「インストール」を押してください。

# 使い方
## ドロップダウンリスト
コンテストページで「問題」タブをクリックすると、コンテスト内の各問題へのリンクがリスト形式で表示され、クリックすることでそれらのページに移動できます。

- ☑新しいタブで開く … チェックを入れると、移動先のページが新しいタブで開きます。
- 問題一覧 … 問題の一覧ページに移動します。
- まとめて開く … 「まとめて開く」ダイアログが開きます。詳しくは下記を参照してください。

![](https://github.com/luuguas/AtCoderListingTasks/assets/69027878/3171abd1-b618-4f04-85e3-7e2f9d835cc7)

## 「まとめて開く」ダイアログ
「まとめて開く…」を押すと、専用のダイアログが開き、複数の問題をまとめて開くことができます。

まずは、開きたい問題の範囲を選択します。なお、一度に開くことのできる問題数の上限は20個です。

- ○すべて … コンテスト内の全ての問題を開きます。
- ○範囲を指定 … 開く問題の範囲を、右のドロップダウンから選択できます。

その他のオプションを選択することもできます。

- ☑逆順で開く … チェックを入れると、選択した問題が逆順で開きます。

そして、右下の「まとめて開く」ボタンを押すことで、選択した問題が開きます。

![](https://github.com/luuguas/AtCoderListingTasks/assets/69027878/734c9a00-b55a-4809-a32a-ec7dd9a781c9)

### 注意
ブラウザの設定でポップアップがブロックされている場合は、ボタンを押しても問題が開きません。その場合はブラウザの設定を変更し、ポップアップを許可してください。

(Chrome では、ポップアップがブロックされるとアドレスバーにアイコンが表示されます。それをクリックして「常に許可する」を選択することで、ポップアップを許可できます。)

# リポジトリ
GitHub: https://github.com/luuguas/AtCoderListingTasks

不具合の報告や改善の提案などがありましたら、[Issues](https://github.com/luuguas/AtCoderListingTasks/issues) または [Pull Requests](https://github.com/luuguas/AtCoderListingTasks/pulls) のページからご連絡ください。
