import React from "react";

type IconProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
};

const defaults = { size: 48, color: "#00d4aa", strokeWidth: 1.5 };

export const IconCamera: React.FC<IconProps> = (p) => {
  const { size, color, strokeWidth: sw } = { ...defaults, ...p };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
};

export const IconBrain: React.FC<IconProps> = (p) => {
  const { size, color, strokeWidth: sw } = { ...defaults, ...p };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a5 5 0 0 1 5 5c0 1.5-.7 2.8-1.7 3.7" />
      <path d="M12 2a5 5 0 0 0-5 5c0 1.5.7 2.8 1.7 3.7" />
      <path d="M15.3 10.7A5 5 0 0 1 18 15c0 2.2-1.5 4-3.5 4.5" />
      <path d="M8.7 10.7A5 5 0 0 0 6 15c0 2.2 1.5 4 3.5 4.5" />
      <path d="M14.5 19.5c.5 1.5.5 2.5.5 2.5H9s0-1 .5-2.5" />
      <line x1="12" y1="10" x2="12" y2="22" />
    </svg>
  );
};

export const IconDashboard: React.FC<IconProps> = (p) => {
  const { size, color, strokeWidth: sw } = { ...defaults, ...p };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="4" rx="1" />
      <rect x="14" y="10" width="7" height="11" rx="1" />
      <rect x="3" y="13" width="7" height="8" rx="1" />
    </svg>
  );
};

export const IconClipboard: React.FC<IconProps> = (p) => {
  const { size, color, strokeWidth: sw } = { ...defaults, ...p };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="16" x2="13" y2="16" />
    </svg>
  );
};

export const IconClock: React.FC<IconProps> = (p) => {
  const { size, color, strokeWidth: sw } = { ...defaults, ...p };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
};

export const IconCheck: React.FC<IconProps> = (p) => {
  const { size, color, strokeWidth: sw } = { ...defaults, ...p };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
};

export const IconChart: React.FC<IconProps> = (p) => {
  const { size, color, strokeWidth: sw } = { ...defaults, ...p };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
};

export const IconShield: React.FC<IconProps> = (p) => {
  const { size, color, strokeWidth: sw } = { ...defaults, ...p };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
};

export const IconEye: React.FC<IconProps> = (p) => {
  const { size, color, strokeWidth: sw } = { ...defaults, ...p };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
};

export const IconTag: React.FC<IconProps> = (p) => {
  const { size, color, strokeWidth: sw } = { ...defaults, ...p };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
};

export const IconTrendUp: React.FC<IconProps> = (p) => {
  const { size, color, strokeWidth: sw } = { ...defaults, ...p };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
};

export const IconStore: React.FC<IconProps> = (p) => {
  const { size, color, strokeWidth: sw } = { ...defaults, ...p };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l1-4h16l1 4" />
      <path d="M3 9v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V9" />
      <path d="M9 21V13h6v8" />
      <path d="M3 9h18" />
    </svg>
  );
};

export const IconArrowRight: React.FC<IconProps> = (p) => {
  const { size, color, strokeWidth: sw } = { ...defaults, ...p };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
};

export const IconArrowDown: React.FC<IconProps> = (p) => {
  const { size, color, strokeWidth: sw } = { ...defaults, ...p };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <polyline points="19 12 12 19 5 12" />
    </svg>
  );
};

export const IconPhone: React.FC<IconProps> = (p) => {
  const { size, color, strokeWidth: sw } = { ...defaults, ...p };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  );
};

export const IconLightbulb: React.FC<IconProps> = (p) => {
  const { size, color, strokeWidth: sw } = { ...defaults, ...p };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
    </svg>
  );
};
