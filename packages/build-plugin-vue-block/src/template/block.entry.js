import 'core-js/stable';
import 'regenerator-runtime/runtime';

import Vue from 'vue';
import Block from '@/block';

new Vue({
  render: h => h(Block),
}).$mount('#mountNode');
