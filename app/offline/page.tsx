import Link from "next/link";

import { Button } from "@/components/ui/Button";
import { StateCard } from "@/components/ui/StateCard";

export default function OfflinePage() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-[720px] items-center justify-center">
      <StateCard
        tone="empty"
        title="当前处于离线状态"
        description="基础页面已经缓存完成。网络恢复后，再回到学习、导入或同步页面继续操作。"
        action={
          <Link href="/">
            <Button>返回首页</Button>
          </Link>
        }
      />
    </div>
  );
}
