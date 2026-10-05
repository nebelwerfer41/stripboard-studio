import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {calendarDate,calendarDatesBetween,shootingDatesForCalendar,boardWithCalendar,
  availableCalendars,selectedCalendar,getCalendarDate,listCalendarDates,
  shootingDaysOnDate,scenesForShootingDay,redFlagsOnDate,redFlagsForShootingDay,redFlagsForScene,redFlagsForStrip,
  outsideCalendarActivity} from '../assets/production-data.js';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/production-data.json',import.meta.url)));
const [five,six]=fixture.calendars;
five.dates=calendarDatesBetween(five,'2026-10-05','2026-10-11');
six.dates=calendarDatesBetween(six,'2026-10-05','2026-10-11');
five.dates.find(day=>day.date==='2026-10-10').shootingDays.push({boardName:'Main',shootingDayNumber:2,groupIndex:1});
const project={calendars:fixture.calendars,defaultCalendar:'Five day',activeBoard:'Main',
  boards:[{name:'Main',calendarName:'Five day',scheduledGroups:[
    {kind:'ScheduleDay',shootingDayNumber:1,date:'2026-10-06',strips:[]},
    {kind:'ScheduleDay',shootingDayNumber:2,date:'2026-10-10',strips:[{kind:'scene',bdsId:'S1'},{kind:'scene',bdsId:'S2'}]}
  ]}],scenes:[{bdsId:'S1',requirements:{'Cast Members':['George']}},
    {bdsId:'S2',requirements:{'Location':['Stage 3']}}],redFlags:fixture.redFlags};

test('activity period includes preparation and wrap dates',()=>{
  const calendar={scheduleDates:{ProductionPrepStartDate:{iso:'2026-10-02'},
    ProductionStartDate:{iso:'2026-10-05'},ProductionEndDate:{iso:'2026-10-12'},
    ProductionWrapDate:{iso:'2026-10-15'}}};
  assert.equal(outsideCalendarActivity(calendar,'2026-10-01'),true);
  assert.equal(outsideCalendarActivity(calendar,'2026-10-02'),false);
  assert.equal(outsideCalendarActivity(calendar,'2026-10-15'),false);
  assert.equal(outsideCalendarActivity(calendar,'2026-10-16'),true);
  assert.equal(outsideCalendarActivity(five,'2026-10-04'),true);
  assert.equal(outsideCalendarActivity(five,'2026-10-06'),false);
});

test('working dates, weekly days off, holiday and exception workday stay distinct',()=>{
  assert.equal(calendarDate(five,'2026-10-06').working,true);
  assert.equal(calendarDate(five,'2026-10-11').working,false);
  assert.equal(calendarDate(five,'2026-10-05').working,false);
  assert.equal(calendarDate(five,'2026-10-05').reason,'Holiday');
  assert.equal(calendarDate(five,'2026-10-10').working,true);
  assert.equal(calendarDate(six,'2026-10-10').working,true);
  assert.equal(five.dates.length,7);
  assert.deepEqual(listCalendarDates(project,'Five day',{start:'2026-10-09',end:'2026-10-11',working:true}).map(day=>day.date),['2026-10-09','2026-10-10']);
});

test('multiple calendars and date-to-shooting-day references remain separate',()=>{
  assert.deepEqual(availableCalendars(project).map(c=>c.name),['Five day','Six day']);
  assert.equal(selectedCalendar(project).name,'Five day');
  assert.equal(getCalendarDate(project,'Five day','2026-10-09').shootingDays.length,0);
  assert.equal(shootingDaysOnDate(project,'Five day','2026-10-10')[0].shootingDayNumber,2);
  assert.equal(shootingDaysOnDate(project,'Six day','2026-10-10').length,0);
  assert.deepEqual(scenesForShootingDay(project,'Main',2).map(s=>s.bdsId),['S1','S2']);
});

test('calendar switch projects the same board without changing source groups',()=>{
  const projected=boardWithCalendar(project,'Main','Six day');
  assert.equal(project.boards[0].calendarName,'Five day');
  assert.equal(projected.calendarName,'Six day');
  assert.equal(projected.sourceCalendarName,'Five day');
  assert.equal(projected.scheduledGroups[1].strips,project.boards[0].scheduledGroups[1].strips);
  assert.deepEqual(shootingDatesForCalendar(six,2),['2026-10-05','2026-10-06']);
  assert.equal(projected.scheduledGroups[1].date,'2026-10-06');
  assert.equal(project.boards[0].scheduledGroups[1].date,'2026-10-10');
  assert.equal(boardWithCalendar(project,'Main','Five day'),project.boards[0]);
});

test('multiple red flags keep their distinct date and target relationships',()=>{
  assert.equal(redFlagsOnDate(project,'2026-10-10').length,3);
  assert.deepEqual(redFlagsForShootingDay(project,'Main',2).map(f=>f.id),['red-flag-1','red-flag-2']);
  assert.deepEqual(redFlagsForScene(project,'S1','2026-10-10').map(f=>f.id),['red-flag-2']);
  assert.deepEqual(redFlagsForScene(project,'S1','2026-10-09'),[]);
  assert.deepEqual(redFlagsForStrip(project,'S1','2026-10-10').map(f=>f.id),['red-flag-1','red-flag-2']);
  assert.deepEqual(redFlagsForStrip(project,'S2','2026-10-10').map(f=>f.id),['red-flag-1']);
  assert.deepEqual(redFlagsForStrip(project,'S2','2026-10-09'),[]);
});
