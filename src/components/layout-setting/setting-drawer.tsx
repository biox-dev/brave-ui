import React from 'react';
import { Button, Divider, Flex, Typography } from 'antd';
import LanguageSelector from '@/components/setting-switcher/language';
import ThemeSelector from '@/components/setting-switcher/theme';

type LayoutSettingDrawerProps = {
  close?: () => void;
};

const LayoutSettingDrawer: React.FC<any> = ({ close }) => {
  return (
    <Flex vertical gap={12}>
      <Typography.Title level={5} style={{ margin: 0 }}>
        Layout Settings
      </Typography.Title>

      <Divider style={{ margin: '4px 0 8px' }} />

      <Flex align="center" justify="space-between" gap={12}>
        <Typography.Text>Language</Typography.Text>
        <LanguageSelector />
      </Flex>

      <Flex align="center" justify="space-between" gap={12}>
        <Typography.Text>Theme</Typography.Text>
        <ThemeSelector />
      </Flex>

      <Divider style={{ margin: '8px 0 4px' }} />

      <Flex justify="flex-end">
        <Button onClick={close}>Close</Button>
      </Flex>
    </Flex>
  );
};

export default LayoutSettingDrawer;
