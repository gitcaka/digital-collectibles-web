'use client';

import { CalendarCheck2, Check, LoaderCircle, ShieldCheck, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { PageHeader } from './page-header';
import type { AppState } from './types';

/** 每日签到（子视图）：连续签到天数 + 七日修行。 */
export function CheckinView({
  app,
  busy,
  onBack,
  onCheckIn,
}: {
  app: AppState;
  busy: string;
  onBack: () => void;
  onCheckIn: () => void;
}) {
  return (
    <>
      <PageHeader title="每日签到" onBack={onBack} />
      <section className="checkin-hero">
        <span>
          <CalendarCheck2 />
        </span>
        <small>连续签到</small>
        <strong>
          {app.points.streak}
          <i>天</i>
        </strong>
        <p>
          {app.points.signedToday ? '今日已完成，明天记得再来' : `今天签到可得 ${Math.min(app.points.streak + 1, 7) * 10} ${app.settings.points}`}
        </p>
      </section>
      <section className="seven-days">
        <div className="week-heading">
          <h2>七日修行</h2>
          <span>第 7 天后重新循环</span>
        </div>
        <div>
          {Array.from({ length: 7 }, (_, index) => index + 1).map((day) => (
            <span key={day} className={day <= app.points.streak ? 'done' : day === app.points.streak + 1 && !app.points.signedToday ? 'today' : ''}>
              <i>{day <= app.points.streak ? <Check /> : day}</i>
              <small>+{day * 10}</small>
            </span>
          ))}
        </div>
        <Button className="primary-cta" disabled={app.points.signedToday || busy === 'checkin'} onClick={() => onCheckIn()}>
          {app.points.signedToday ? (
            <>
              <Check /> 今日已签到
            </>
          ) : busy === 'checkin' ? (
            <LoaderCircle className="spin" />
          ) : (
            <>
              签到领取{app.settings.points} <Sparkles />
            </>
          )}
        </Button>
      </section>
      <section className="rule-card">
        <ShieldCheck />
        <div>
          <strong>签到规则</strong>
          <p>每日零点更新。连续第 N 天获得 10 × N {app.settings.points}，第 7 天封顶后重新开始。</p>
        </div>
      </section>
    </>
  );
}
