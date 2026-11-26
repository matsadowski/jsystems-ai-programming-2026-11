import Image from "next/image";

export type AppHeaderProps = {
  onNewCase?: () => void;
  /** Reference logo is a third-party trademark: course demos only, never passed in this PoC. */
  showDemoLogo?: boolean;
};

export function AppHeader({ onNewCase, showDemoLogo = false }: AppHeaderProps) {
  return (
    <header className="border-b border-border-default bg-bg-light">
      <div className="mx-auto flex min-h-16 w-full max-w-[1040px] items-center justify-between gap-4 px-4 py-2">
        <div className="flex items-center gap-3 font-bold text-text-primary">
          {showDemoLogo ? <Image src="/logo.png" alt="" width={48} height={48} /> : null}
          <span>Hardware Service Decision Copilot</span>
        </div>
        {onNewCase ? (
          <button
            type="button"
            onClick={onNewCase}
            className="min-h-11 shrink-0 cursor-pointer rounded-lg border-2 border-brand-primary bg-transparent px-6 py-2 font-bold text-brand-primary hover:bg-tint-pink"
          >
            Nowe zgłoszenie
          </button>
        ) : null}
      </div>
    </header>
  );
}
