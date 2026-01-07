import React from 'react';
import { weekNumber } from '../utils/timeMangment';

export const WeekCounter: React.FC = () => {
  return (
    <div className="text-sm text-primary-foreground">
      Current week: {weekNumber}
    </div>
  );
};
