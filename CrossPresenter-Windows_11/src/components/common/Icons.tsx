/**
 * Inline icon set.
 *
 * A dependency-free 20x20 stroke set covers every glyph the console needs, so
 * the bundle carries no icon-font or sprite-sheet fetch on first paint.
 */

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps, children: React.ReactNode) {
  const { className, ...rest } = props;
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "h-4 w-4"}
      {...rest}
    >
      {children}
    </svg>
  );
}

export const SettingsIcon = (p: IconProps) =>
  base(
    p,
    <>
      <circle cx="10" cy="10" r="2.6" />
      <path d="M10 2.5v2M10 15.5v2M4.5 4.5l1.4 1.4M14.1 14.1l1.4 1.4M2.5 10h2M15.5 10h2M4.5 15.5l1.4-1.4M14.1 5.9l1.4-1.4" />
    </>,
  );

export const ImageIcon = (p: IconProps) =>
  base(
    p,
    <>
      <rect x="2.5" y="3.5" width="15" height="13" rx="1.6" />
      <circle cx="7" cy="8" r="1.4" />
      <path d="M3 14.5l4.2-4.2a1.5 1.5 0 0 1 2.12 0L13 14" />
      <path d="M11.5 12.5l1.8-1.8a1.5 1.5 0 0 1 2.12 0L17.5 13" />
    </>,
  );

export const VideoIcon = (p: IconProps) =>
  base(
    p,
    <>
      <rect x="2.5" y="4.5" width="11" height="11" rx="1.6" />
      <path d="M13.5 8.2l4-2.2v8l-4-2.2" />
    </>,
  );

export const LayersIcon = (p: IconProps) =>
  base(
    p,
    <>
      <path d="M10 2.8l6.6 3.4-6.6 3.4-6.6-3.4L10 2.8z" />
      <path d="M3.4 10l6.6 3.4 6.6-3.4" />
      <path d="M3.4 13.6l6.6 3.4 6.6-3.4" />
    </>,
  );

export const GlobeIcon = (p: IconProps) =>
  base(
    p,
    <>
      <circle cx="10" cy="10" r="7.3" />
      <path d="M2.7 10h14.6M10 2.7a10.6 10.6 0 0 1 0 14.6M10 2.7a10.6 10.6 0 0 0 0 14.6" />
    </>,
  );

export const PlusIcon = (p: IconProps) => base(p, <path d="M10 3.5v13M3.5 10h13" />);

export const ExternalLinkIcon = (p: IconProps) =>
  base(
    p,
    <>
      <path d="M8 4.5H4.6a1.1 1.1 0 0 0-1.1 1.1v9.8a1.1 1.1 0 0 0 1.1 1.1h9.8a1.1 1.1 0 0 0 1.1-1.1V12" />
      <path d="M9 11l7-7M11.5 4h4.5v4.5" />
    </>,
  );

export const XIcon = (p: IconProps) => base(p, <path d="M4.5 4.5l11 11M15.5 4.5l-11 11" />);

export const GripIcon = (p: IconProps) =>
  base(
    p,
    <>
      <circle cx="7" cy="5.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="7" cy="10" r="1" fill="currentColor" stroke="none" />
      <circle cx="7" cy="14.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="5.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="10" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="14.5" r="1" fill="currentColor" stroke="none" />
    </>,
  );

export const DownloadIcon = (p: IconProps) =>
  base(p, <><path d="M10 3v9.5M6 9l4 4 4-4" /><path d="M3.5 15.5v1.2c0 .7.6 1.3 1.3 1.3h10.4c.7 0 1.3-.6 1.3-1.3v-1.2" /></>);

export const UploadIcon = (p: IconProps) =>
  base(p, <><path d="M10 13V3.5M6 7.5l4-4 4 4" /><path d="M3.5 15.5v1.2c0 .7.6 1.3 1.3 1.3h10.4c.7 0 1.3-.6 1.3-1.3v-1.2" /></>);

export const SearchIcon = (p: IconProps) =>
  base(p, <><circle cx="8.6" cy="8.6" r="5.4" /><path d="M16.5 16.5l-3.6-3.6" /></>);

export const PlayIcon = (p: IconProps) => base(p, <path d="M5.5 3.8v12.4l10-6.2-10-6.2z" fill="currentColor" stroke="none" />);

export const TrashIcon = (p: IconProps) =>
  base(p, <><path d="M3.5 6h13M8 6V4.3c0-.5.4-.8.8-.8h2.4c.4 0 .8.3.8.8V6M6 6l.7 10c.05.7.6 1.2 1.3 1.2h4c.7 0 1.25-.5 1.3-1.2L14 6" /></>);

export const DuplicateIcon = (p: IconProps) =>
  base(p, <><rect x="3" y="3" width="10" height="10" rx="1.4" /><path d="M8.4 13v2.6c0 .8.6 1.4 1.4 1.4h5.8c.8 0 1.4-.6 1.4-1.4V8.8c0-.8-.6-1.4-1.4-1.4H13" /></>);

export const ChevronDownIcon = (p: IconProps) => base(p, <path d="M4.5 7.5l5.5 5.5 5.5-5.5" />);

export const ChevronLeftIcon = (p: IconProps) => base(p, <path d="M12.5 4.5l-5.5 5.5 5.5 5.5" />);

export const ChevronRightIcon = (p: IconProps) => base(p, <path d="M7.5 4.5l5.5 5.5-5.5 5.5" />);

export const BlackIcon = (p: IconProps) => base(p, <rect x="3" y="3" width="14" height="14" rx="2" fill="currentColor" stroke="none" />);

export const ClearTextIcon = (p: IconProps) =>
  base(p, <><path d="M4 5h12M4 10h8M4 15h5" /><path d="M14.5 12.5l4 4M18.5 12.5l-4 4" /></>);

export const ClearBgIcon = (p: IconProps) =>
  base(p, <><rect x="2.7" y="3.5" width="14.6" height="13" rx="1.6" strokeDasharray="2.6 2.4" /></>);

export const BookIcon = (p: IconProps) =>
  base(p, <><path d="M4 3.6h4.6c1 0 1.9.8 1.9 1.9v11c0-.9-.7-1.6-1.6-1.6H4V3.6z" /><path d="M16 3.6h-4.6c-1 0-1.9.8-1.9 1.9v11c0-.9.7-1.6 1.6-1.6H16V3.6z" /></>);

export const BibleCrossIcon = (p: IconProps) =>
  base(p, <path d="M10 3v14M4.5 8h11" />);

export const MusicIcon = (p: IconProps) =>
  base(
    p,
    <>
      <path d="M8 15.2V5.4l7.5-1.6v9.6" />
      <circle cx="6" cy="15.4" r="2" />
      <circle cx="13.5" cy="13.6" r="2" />
    </>,
  );

export const FolderIcon = (p: IconProps) =>
  base(
    p,
    <path d="M2.8 5.4a1.4 1.4 0 0 1 1.4-1.4h3l1.6 2h7a1.4 1.4 0 0 1 1.4 1.4v7.2a1.4 1.4 0 0 1-1.4 1.4H4.2a1.4 1.4 0 0 1-1.4-1.4V5.4z" />,
  );

export const MonitorIcon = (p: IconProps) =>
  base(p, <><rect x="2.5" y="3.5" width="15" height="10" rx="1.4" /><path d="M7 16.5h6M10 13.5v3" /></>);

export const AlignLeftIcon = (p: IconProps) =>
  base(p, <path d="M3 5h14M3 9h9M3 13h14M3 17h9" />);

export const AlignCenterIcon = (p: IconProps) =>
  base(p, <path d="M3 5h14M6 9h8M3 13h14M6 17h8" />);

export const AlignRightIcon = (p: IconProps) =>
  base(p, <path d="M3 5h14M8 9h9M3 13h14M8 17h9" />);

export const AlignJustifyIcon = (p: IconProps) =>
  base(p, <path d="M3 5h14M3 9h14M3 13h14M3 17h14" />);

export const EyeIcon = (p: IconProps) =>
  base(
    p,
    <>
      <path d="M1.9 10S4.7 4.8 10 4.8 18.1 10 18.1 10 15.3 15.2 10 15.2 1.9 10 1.9 10z" />
      <circle cx="10" cy="10" r="2.4" />
    </>,
  );

export const EyeOffIcon = (p: IconProps) =>
  base(
    p,
    <>
      <path d="M3 3l14 14" />
      <path d="M8.2 5.1A8.7 8.7 0 0 1 10 4.8c5.3 0 8.1 5.2 8.1 5.2a15.6 15.6 0 0 1-2.6 3.1M5.2 6.2A15.2 15.2 0 0 0 1.9 10S4.7 15.2 10 15.2a8.9 8.9 0 0 0 3.4-.7" />
      <path d="M8.3 8.4a2.4 2.4 0 0 0 3.3 3.3" />
    </>,
  );

export const TimerIcon = (p: IconProps) =>
  base(
    p,
    <>
      <circle cx="10" cy="11" r="6.2" />
      <path d="M10 7.8V11l2.2 1.6M7.6 2.6h4.8" />
    </>,
  );

export const MessageIcon = (p: IconProps) =>
  base(
    p,
    <>
      <path d="M3 4.4h14v9.4H8.6L5 17v-3.2H3V4.4z" />
      <path d="M6.4 8h7.2M6.4 10.6h4.6" />
    </>,
  );
