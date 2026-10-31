import SQLite from 'react-native-sqlite-storage';

export const db = SQLite.openDatabase({
  name: 'office_attendance.db',
  location: 'default',
});