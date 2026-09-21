'use client';

import { useEffect } from 'react';

const LOADING_SELECTORS = [
  '.dashboard-loading',
  '.page-loading',
  '.loading-screen',
  '.loading-state',
  '.section-loading',
  '[data-loading-screen]',
].join(',');

const STYLE_ID = 'madhuli-inline-loading-style';

export default function LoadingExperienceGuard() {
  useEffect(() => {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      ${LOADING_SELECTORS} {
        min-height: 0 !important;
        height: auto !important;
        max-height: none !important;
        padding: 22px !important;
        margin: 18px 0 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: flex-start !important;
        gap: 10px !important;
        border: 1px dashed var(--line, #e7ddd5) !important;
        border-radius: 14px !important;
        background: var(--surface, #fffaf7) !important;
        box-sizing: border-box !important;
      }

      ${LOADING_SELECTORS} .loading-mark {
        width: 32px !important;
        height: 32px !important;
        min-width: 32px !important;
        margin: 0 !important;
        border-radius: 10px !important;
        font-size: 16px !important;
      }

      ${LOADING_SELECTORS} strong,
      ${LOADING_SELECTORS} span {
        font-size: 12px !important;
        line-height: 1.5 !important;
      }
    `;
    document.head.appendChild(style);

    const markLoadingBlocks = () => {
      document.querySelectorAll<HTMLElement>(LOADING_SELECTORS).forEach((element) => {
        if (element.dataset.inlineLoading === 'true') return;
        element.dataset.inlineLoading = 'true';
      });
    };

    const observer = new MutationObserver(markLoadingBlocks);
    observer.observe(document.body, { childList: true, subtree: true });
    markLoadingBlocks();

    return () => {
      observer.disconnect();
      document.getElementById(STYLE_ID)?.remove();
    };
  }, []);

  return null;
}
