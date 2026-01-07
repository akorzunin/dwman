import { FC } from 'react';

const SettingsTitle: FC = () => {
  return (
    <div className="contents w-full">
      <div className="w-full rounded-md border border-transparent bg-secondary px-4 py-2 font-medium text-secondary-foreground shadow-sm transition-opacity hover:opacity-80">
        Settings:
      </div>
    </div>
  );
};

export default SettingsTitle;
