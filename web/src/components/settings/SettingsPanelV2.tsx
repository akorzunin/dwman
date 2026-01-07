import { useAtomValue } from 'jotai';
import { UserDataAtom } from '../../store/store';
import AccountStatus from '../UserSettingsField/AccountStatus';
import SettingsTitle from '../UserSettingsField/SettingsTitle';
import { SettingsForm } from './SettingsForm';
import { cn } from '../../lib/utils';

export const SettingsPanelV2 = ({ className }: { className?: string }) => {
  const userData = useAtomValue(UserDataAtom);
  return (
    <div className={cn('flex w-full flex-col gap-y-3', className)}>
      <SettingsTitle />
      <AccountStatus IsPremium={userData.is_premium} />
      <SettingsForm />
      <div className="h-28 laptop:h-0"></div>
    </div>
  );
};
