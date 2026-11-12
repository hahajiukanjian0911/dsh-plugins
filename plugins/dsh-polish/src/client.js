window.__ModuleLoader__.load({
  id: 'dsh-polish',
  factory(require) {
    const React = require('react');
    const P = require('@deepseek-ai/dsh-client-ui-primitives');
    const stylesheet = /* @polish-styles */ '';
    /* @polish-tooltips */
    /* @polish-motion */
    /* @polish-composer */
    /* @polish-worktree */
    /* @polish-dropdowns */
    /* @polish-titlebar */
    /* @polish-native-scrollbars */
    /* @polish-conversation-width */
    return {
      inject: [],
      apply(ctx) {
        ctx.effect(() => {
          const style = document.createElement('style');
          style.dataset.dshPolish = 'icons';
          style.textContent = stylesheet;
          document.head.appendChild(style);
          return () => style.remove();
        }, 'polish: icons and tooltip styles');
        ctx.effect(() => mountTooltips(document, window), 'polish: sidebar tooltips');
        ctx.effect(() => mountMotion(document, window), 'polish: scoped sidebar motion');
        ctx.effect(() => mountNativeScrollbars(document, window), 'polish: native app scrollbars');
        installConversationWidthSettings(ctx, React, P);
        installTitlebar(ctx, React, P);
        installComposerLayout(ctx, React);
        installWorktreeMenu(ctx, React, P);
        ctx.effect(() => mountDropdowns(document, window), 'polish: composer dropdown placement');
      },
    };
  },
});
