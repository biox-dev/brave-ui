import React from "react";
import { Card } from "antd";
import type { CardProps } from "antd";

type BorderlessCardProps = CardProps;

const mergeClassNames = (...classNames: Array<string | undefined>) =>
  classNames.filter(Boolean).join(" ");

const BorderlessCard: React.FC<BorderlessCardProps> = ({ className, styles, style, size, ...rest }) => {
  const bodyStyles = styles?.body ?? {};

  return (
    <Card
      {...rest}
      size={size ?? "small"}
      className={mergeClassNames("layout-sharp-side-card", className)}
      style={{
        // height: "100%",
        border: 0,
        borderRadius: 0,
        boxShadow: "none",
        ...style,
      }}
      styles={{
        ...styles,
        body: {
          // height: "100%",
          padding: 0,
          overflow: "auto",
        
          ...bodyStyles,
        },
      }}
    />
  );
};

export default BorderlessCard;