import React from 'react';
import { APP_ICON_SRC, APP_NAME } from '../config/app';

export default function AppLogo({ size, className = '' }) {
  return (
    <img
      src={APP_ICON_SRC}
      alt={APP_NAME}
      {...(size != null ? { width: size, height: size } : {})}
      className={['app-logo', className].filter(Boolean).join(' ')}
      decoding="async"
      draggable={false}
    />
  );
}
