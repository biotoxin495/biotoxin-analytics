import {createAnalytics} from '@biotoxin/analytics';
export const analytics = createAnalytics({
  measurementId: import.meta.env.VITE_GA_MEASUREMENT_ID,
  enabled: import.meta.env.PROD,
  allowedHosts: ['your-app.biotoxin.dev'],
  pages: {home: {path:'/',title:'Home'}, listing:{path:'/items',title:'Items'}, detail:{path:'/items/detail',title:'Item details'}, privacy:{path:'/privacy',title:'Privacy notice'}},
  events: {data_export:{format:{type:'enum',values:['csv','json']}}},
});
