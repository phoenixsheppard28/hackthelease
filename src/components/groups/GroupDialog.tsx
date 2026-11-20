"use client";

import { Modal } from "@mantine/core";
import { GroupDashboard } from "./GroupDashboard";

export function GroupDialog({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  return <Modal opened={opened} onClose={onClose} title="Housing group" size={640} centered radius={16} closeButtonProps={{ "aria-label": "Close housing group" }}>
    <GroupDashboard />
  </Modal>;
}
