import { COLORS } from './model.mjs';

const GLYPHS = { folder: 'IconFolderCloseRegular', code: 'IconCodeOutlineRegular', document: 'IconDeliverDocOutlineRegular',
  globe: 'IconGlobeOutlineRegular', settings: 'IconSettingsOutlineRegular', database: 'IconDatabaseOutlineRegular',
  shield: 'IconShieldOutlineRegular', branch: 'IconBranchOutlineRegular', sparkle: 'IconSparkleOutlineRegular',
  clock: 'IconClockOutlineRegular', chat: 'IconNewChatOutlineRegular', link: 'IconLinkOutlineRegular' };

// Both the settings page and the conversation sidebar render this identity.
export function createProjectIcon(React, P) {
  return function ProjectIcon({ project, large = false, compact = false }) {
    const value = project.icon, name = project.name || '项目';
    const letters = [...name.replace(/[^\p{L}\p{N}]/gu, '')].slice(0, 2).join('').toUpperCase() || 'P';
    const color = value?.color || COLORS[[...name].reduce((a, c) => a + c.codePointAt(0), 0) % COLORS.length];
    return <span aria-hidden="true" className={'dpm-project-icon' + (large ? ' dpm-large' : '') + (compact ? ' dpm-compact' : '')}
      style={{ '--dpm-icon-color': color }}>
      {value?.kind === 'image' ? <img alt="" src={value.value} />
        : value?.kind === 'glyph' ? React.createElement(P[GLYPHS[value.value]] || P.IconFolderCloseRegular, { size: large ? 24 : compact ? 16 : 18 })
        : value?.kind === 'emoji' ? <span className="dpm-emoji">{value.value}</span>
        : <span>{value?.kind === 'monogram' ? value.value : letters}</span>}
    </span>;
  };
}
