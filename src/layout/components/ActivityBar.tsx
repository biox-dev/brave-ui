import React from 'react';

export type ActivityBarItem = {
  key: string;
  label: string;
  icon: React.ReactNode;
};

type ActivityBarProps = {
  items: ActivityBarItem[];
  activeKey: string;
  onChange: (key: string) => void;
  bottomItems?: ActivityBarItem[];
};

const ActivityBar: React.FC<ActivityBarProps> = ({
  items,
  activeKey,
  onChange,
  bottomItems = [],
}) => {
  return (
    <div className="layout-activitybar" aria-label="Primary sidebar">
      <div className="layout-activitybar-main">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            title={item.label}
            aria-label={item.label}
            aria-current={activeKey === item.key ? 'page' : undefined}
            className={`layout-activitybar-btn ${activeKey === item.key ? 'is-active' : ''}`}
            onClick={() => onChange(item.key)}
          >
            <span className="layout-activitybar-icon">{item.icon}</span>
          </button>
        ))}
      </div>

      {bottomItems.length > 0 && (
        <div className="layout-activitybar-bottom">
          {bottomItems.map((item) => (
            <button
              key={item.key}
              type="button"
              title={item.label}
              aria-label={item.label}
              className={`layout-activitybar-btn ${activeKey === item.key ? 'is-active' : ''}`}
              onClick={() => onChange(item.key)}
            >
              <span className="layout-activitybar-icon">{item.icon}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ActivityBar;