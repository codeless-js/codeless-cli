import Vue from 'vue';
import ViewUI from 'view-design';
import 'view-design/dist/styles/iview.css';

import Block from '@/block';

Vue.use(ViewUI);

new Vue({
  render: h => h(Block),
}).$mount('#mountNode');
