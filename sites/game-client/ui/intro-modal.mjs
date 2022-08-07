// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import Modal from './modal.mjs';

const INTRO_MODAL_DIV = 'intro-modal';
const INTRO_PAGES = 'intro-pages';
const INTRO_CURRENT_PAGE = 'intro-current-page';
const INTRO_MAX_PAGE = 'intro-max-page';
const INTRO_NEXT_PAGE = 'intro-next-page';
const INTRO_SKIP = 'intro-skip';

const introPagesData = [
  {
    title: '歡迎來到 HITCON Online',
    description: [
      '透過方向鍵或 WASD 可控制角色移動',
      '若碰到人物卡住的情況，可使用鬼魂模式穿透',
    ],
    images: ['/static/sites/game-client/intro-1-moving.svg', '/static/sites/game-client/intro-1-ghost-mode.svg'],
  },
  {
    title: '與他人交流',
    description: [
      '在文字聊天室可與其他會眾、講師交流',
      '也可以點擊其他玩家，傳送私人訊息',
    ],
    images: ['/static/sites/game-client/intro-2@2x.png']
  },
  {
    title: '與他人交流',
    description: [
      '只要靠近地圖四處的桌椅，便可以進入線上會議室，與同桌的人語音聊天或者分享螢幕畫面。',
      '您可透過右上角按鈕控制麥克風與視訊開關。',
    ],
    images: ['/static/sites/game-client/intro-3@2x.png']
  },
  {
    title: '線上會議室',
    description: [
      '在線上會議室中，可在畫面右側看到同房間的與會者',
      '也可點選與會者圖像旁的功能鍵，選擇把特定與會者全螢幕或置頂顯示',
    ],
    images: ['/static/sites/game-client/intro-4@2x.png'],
  },
  {
    title: '與 NPC 互動',
    description: [
      '大會中有些活動可透過與 NPC 互動參與',
      'NPC 在地圖上會有明顯的名稱標示',
      '可透過直接點擊 NPC 進行互動'
    ],
    images: [
      '/static/sites/game-client/intro-5-1@2x.png',
      '/static/sites/game-client/intro-5-2@2x.png'
    ],
  },
    {
    title: '更改設定',
    description: ['若需切換音／視訊裝置，可在設定頁面進行', '也可以在這裡進行角色、暱稱更改等設定'],
    images: ['/static/sites/game-client/intro-6@2x.png'],
    contentDirection: 'row',
  },
];

class IntroModal extends Modal {
  constructor(mainUI) {
    const dom = document.getElementById(INTRO_MODAL_DIV);

    super(mainUI, dom);
    this.currentPageText = document.getElementById(INTRO_CURRENT_PAGE);
    this.maxPageText = document.getElementById(INTRO_MAX_PAGE);
    this.pages = document.getElementById(INTRO_PAGES);
    this.pageIndex = 0;
    this.currentPageText.textContent = this.pageIndex + 1;

    for (const data of introPagesData) {
      this.pages.appendChild(this.generatePage(data));
    }

    this.maxPageIndex = this.pages.childElementCount - 1;
    this.maxPageText.textContent = this.pages.childElementCount;
    this.pages.childNodes[0].classList.remove('intro-page--inactive');

    this.nextPageButton = document.getElementById(INTRO_NEXT_PAGE);
    this.skipButton = document.getElementById(INTRO_SKIP);
    this.nextPageButton.addEventListener('click', () => {
      this.nextPage();
      if (this.nextPageButton.textContent === 'Enter HITCON Online') this.hide();
      if (this.pageIndex === this.maxPageIndex) {
        this.nextPageButton.textContent = 'Enter HITCON Online';
        this.skipButton.classList.add('hide');
      } else {
        this.skipButton.classList.remove('hide');
      }
    });
    this.skipButton.addEventListener('click', () => {
      this.hide();
    });
  }

  nextPage() {
    if (this.pageIndex === this.maxPageIndex) return;
    this.pages.childNodes[this.pageIndex].classList.add('intro-page--inactive');
    this.pages.childNodes[this.pageIndex + 1].classList.remove('intro-page--inactive');
    this.pageIndex += 1;
    this.currentPageText.textContent = this.pageIndex + 1;
  }

  generatePage(data) {
    const introPage = document.createElement('div');
    const introTitle = document.createElement('div');
    const introDescription = document.createElement('div');
    const introImages = document.createElement('div');
    const introLayout = document.createElement('div');
    introPage.classList.add('intro-page');
    introPage.classList.add('intro-page--inactive');
    introLayout.classList.add('intro-layout');

    if (data.contentDirection === 'row') {
      introLayout.classList.add('intro-layout--row');
    } else {
      introLayout.classList.add('intro-layout');
    }

    introTitle.classList.add('intro-title');
    introDescription.classList.add('intro-description');
    introImages.classList.add('intro-images');
    introTitle.textContent = data.title;
    for (const text of data.description) {
      const textNode = document.createTextNode(text);
      introDescription.appendChild(textNode);
      introDescription.appendChild(document.createElement('br'));
    }

    for (const src of data.images) {
      const img = document.createElement('img');
      img.setAttribute('src', `${src}`);
      introImages.appendChild(img);
    }

    introLayout.appendChild(introDescription);
    introLayout.appendChild(introImages);
    introPage.appendChild(introTitle);
    introPage.appendChild(introLayout);
    return introPage;
  }

  canDismiss() {
    return true;
  }
}


export default IntroModal;
