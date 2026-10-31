const fs = require('fs');
const path = require('path');

// Path to the react-native-sqlite-storage build.gradle file
const gradlePath = path.join(
  __dirname,
  'node_modules',
  'react-native-sqlite-storage',
  'platforms',
  'android',
  'build.gradle'
);

try {
  // Read the current content
  let content = fs.readFileSync(gradlePath, 'utf8');
  
  // Replace all occurrences of jcenter() with mavenCentral()
  const updatedContent = content.replace(/jcenter\(\)/g, 'mavenCentral()');
  
  // Only write if changes were made
  if (content !== updatedContent) {
    fs.writeFileSync(gradlePath, updatedContent);
    console.log('✅ Fixed react-native-sqlite-storage build.gradle: replaced jcenter() with mavenCentral()');
  } else {
    console.log('ℹ️ react-native-sqlite-storage build.gradle already up to date');
  }
} catch (error) {
  console.warn('⚠️ Could not fix react-native-sqlite-storage build.gradle:', error.message);
}