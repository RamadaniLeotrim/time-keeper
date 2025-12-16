import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
    id: integer('id').primaryKey(),
    email: text('email').notNull().unique(),
    password: text('password').notNull(), // Hashed
    name: text('name').notNull(),
    role: text('role').notNull().default('user'), // 'admin' | 'user'
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
});

export const userConfig = sqliteTable('user_config', {
    id: integer('id').primaryKey(),
    userId: integer('user_id').references(() => users.id).notNull(),
    weeklyTargetHours: integer('weekly_target_hours').notNull().default(40),
    yearlyVacationDays: integer('yearly_vacation_days').notNull().default(25),
    initialOvertimeBalance: integer('initial_overtime_balance').notNull().default(0), // in minutes
    vacationCarryover: integer('vacation_carryover').notNull().default(0), // in days
});

export const timeEntries = sqliteTable('time_entries', {
    id: integer('id').primaryKey(),
    userId: integer('user_id').references(() => users.id).notNull(),
    date: text('date').notNull(), // ISO Date YYYY-MM-DD
    type: text('type', { enum: ['work', 'vacation', 'sick', 'accident', 'holiday', 'school', 'special', 'trip', 'other'] }).notNull().default('work'),
    value: real('value').notNull().default(1.0), // 1.0 or 0.5
    startTime: text('start_time'), // HH:mm
    endTime: text('end_time'), // HH:mm
    pauseDuration: integer('pause_duration').default(0), // in minutes
    notes: text('notes'),
});
