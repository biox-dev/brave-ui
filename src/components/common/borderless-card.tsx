import React from 'react';

export type BorderlessCardProps = {
  title?: React.ReactNode;
  extra?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  styles?: {
    header?: React.CSSProperties;
    body?: React.CSSProperties;
  };
  size?: 'small' | 'default';
  /** 头部对齐方式：center 让标题内容（如主区域标签页）在头部正中，extra 绝对定位到右侧 */
  headAlign?: 'left' | 'center';
};

const mergeClassNames = (...classNames: Array<string | undefined>) =>
  classNames.filter(Boolean).join(' ');

/**
 * 无边框面板：用普通 div 实现（不再依赖 antd Card），
 * 头部一条 1px 分隔线，body 撑满剩余高度并可滚动。
 */
const BorderlessCard: React.FC<BorderlessCardProps> = ({
  title,
  extra,
  children,
  className,
  style,
  styles,
  size = 'small',
  headAlign = 'left',
}) => {
  const hasHead = title !== undefined || extra !== undefined;

  return (
    <div
      className={mergeClassNames(
        'layout-sharp-side-card',
        size === 'small' ? 'is-small' : undefined,
        className,
      )}
      style={style}
    >
      {hasHead && (
        <div className={`layout-sharp-side-card-head is-${headAlign}`} style={styles?.header}>
          <div className="layout-sharp-side-card-head-title">{title}</div>
          {extra !== undefined && (
            <div className="layout-sharp-side-card-head-extra">{extra}</div>
          )}
        </div>
      )}
      <div className="layout-sharp-side-card-body" style={styles?.body}>
        {children}
      </div>
    </div>
  );
};

export default BorderlessCard;