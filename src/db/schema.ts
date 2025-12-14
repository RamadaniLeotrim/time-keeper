import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const userConfig = sqliteTable('user_config', {
    id: integer('id').primaryKey(),
    weeklyTargetHours: integer('weekly_target_hours').notNull().default(40),
    yearlyVacationDays: integer('yearly_vacation_days').notNull().default(25),
    initialOvertimeBalance: integer('initial_overtime_balance').notNull().default(0), // in minutes
    vacationCarryover: integer('vacation_carryover').notNull().default(0), // in days
});

export const timeEntries = sqliteTable('time_entries', {
    id: integer('id').primaryKey(),
    date: text('date').notNull(), // ISO Date YYYY-MM-DD
    type: text('type', { enum: ['work', 'vacation', 'sick', 'accident', 'holiday', 'school', 'special', 'trip', 'other'] }).notNull().default('work'),
    startTime: text('start_time'), // HH:mm
    endTime: text('end_time'), // HH:mm
    pauseDuration: integer('pause_duration').default(0), // in minutes
    notes: text('notes'),
});
