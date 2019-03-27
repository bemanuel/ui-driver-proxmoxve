/*!!!!!!!!!!!Do not change anything between here (the DRIVERNAME placeholder will be automatically replaced at buildtime)!!!!!!!!!!!*/
import NodeDriver from 'shared/mixins/node-driver';

// do not remove LAYOUT, it is replaced at build time with a base64 representation of the template of the hbs template
// we do this to avoid converting template to a js file that returns a string and the cors issues that would come along with that
const LAYOUT;
/*!!!!!!!!!!!DO NOT CHANGE END!!!!!!!!!!!*/

const NET_MODEL_CHOICES = [
  {
    'name':  'Intel e1000',
    'value': 'e1000'
  },
  {
    'name':  'virtio (Paravirtualized)',
    'value': 'virtio'
  },  
  {
    'name':  'Realtek RTL8139',
    'value': 'rtl8139'
  },
  {
    'name':  'VMware vmxnet3',
    'value': 'vmxnet3'
  },
];

/*!!!!!!!!!!!GLOBAL CONST START!!!!!!!!!!!*/
// EMBER API Access - if you need access to any of the Ember API's add them here in the same manner rather then import them via modules, since the dependencies exist in rancher we dont want to expor the modules in the amd def
const computed     = Ember.computed;
const get          = Ember.get;
const set          = Ember.set;
const alias        = Ember.computed.alias;
const service      = Ember.inject.service;

const setProperties = Ember.setProperties;

const defaultRadix = 10;
const defaultBase  = 1024;
/*!!!!!!!!!!!GLOBAL CONST END!!!!!!!!!!!*/



/*!!!!!!!!!!!DO NOT CHANGE START!!!!!!!!!!!*/
export default Ember.Component.extend(NodeDriver, {
  driverName:     '%%DRIVERNAME%%',
  config:          alias('model.%%DRIVERNAME%%Config'),
  app:             service(),
  authToken:       null,
  netModelChoices: NET_MODEL_CHOICES,
  step:            1,
  bridges:         null, 

  init() {
    // This does on the fly template compiling, if you mess with this :cry:
    const decodedLayout = window.atob(LAYOUT);
    const template      = Ember.HTMLBars.compile(decodedLayout, {
      moduleName: 'nodes/components/driver-%%DRIVERNAME%%/template'
    });
    set(this,'layout', template);

    this._super(...arguments);

  },
  /*!!!!!!!!!!!DO NOT CHANGE END!!!!!!!!!!!*/

  // Write your component here, starting with setting 'model' to a machine with your config populated
  bootstrap: function() {
    // bootstrap is called by rancher ui on 'init', you're better off doing your setup here rather then the init function to ensure everything is setup correctly

    let resourceFields = get(this, 'resourceFields');
    console.log('resourceFields: ', resourceFields);
    console.log('resourceFields: ', resourceFields['cpuCores']);
    console.log('resourceFields: ', resourceFields['cpuCores'].default);
    console.log('resourceFields: ', resourceFields['cpuCores'].description);
    console.log('resourceFields: ', this.fieldDef('cpuCores').default);
    console.log('schema: ', get(this, 'schema'));

    let config = get(this, 'globalStore').createRecord({
      type:                   '%%DRIVERNAME%%Config',
      user:                   this.fieldDef('user').default,
      realm:                  this.fieldDef('realm').default,
      password:               '.VmNode1#',
      host:                   /*this.fieldDef('host').default*/ 'pve.wdc.modil.io',
      node:                   /*this.fieldDef('node').default*/ 'pve',
      port:                   8006,
      cpuSockets:             this.fieldDef('cpuSockets').default,
      cpuCores:               this.fieldDef('cpuCores').default,
      memoryGb:               this.fieldDef('memoryGb').default,
      netModel:               this.fieldDef('netModel').default,
      netBridge:              this.fieldDef('netBridge').default,
      netVlantag:             this.fieldDef('netVlantag').default,
      pool:                   this.fieldDef('pool').default,
      guestUername:           'rancher',
      guestPassword:          '',
      guestSshPrivateKey:     '',
      guestSshPublicKey:      '',
      guestSshAuthorizedKeys: '',
    });

    set(this, 'model.%%DRIVERNAME%%Config', config);
    console.log('schema: ', get(this, 'schema'));
  },
  resourceFields: computed('driverName', 'schema', function() {
    if (get(this, 'schema')) {
      return get(this, 'schema').get('resourceFields');
    }
  }),
  fieldNames: computed('driverName', 'schema', function() {
    if (get(this, 'schema')) {
      return Object.keys(get(this, 'schema').get('resourceFields'));
    }
  }),
  schema: computed('driverName', function() {
    const configName = `${ get(this, 'driverName') }Config`;

    return get(this, 'globalStore').getById('schema', configName.toLowerCase());
  }),
  fieldDef: function(fieldName) {
    let fields = get(this, 'resourceFields');
    return fields[fieldName];
  },
  // Add custom validation beyond what can be done from the config API schema
  validate() {
    // Get generic API validation errors
    this._super();
    var errors = get(this, 'errors')||[];
    if ( !get(this, 'model.name') ) {
      errors.push('Name is required');
    }

    // Add more specific errors

    // Check something and add an error entry if it fails:
    /*
    if ( parseInt(get(this, 'config.memorySize'), defaultRadix) < defaultBase ) {
      errors.push('Memory Size must be at least 1024 MB');
    }
    */

    // Set the array of errors for display,
    // and return true if saving should continue.
    if ( get(errors, 'length') ) {
      set(this, 'errors', errors);
      return false;
    } else {
      set(this, 'errors', null);
      return true;
    }
  },

  actions: {
    proxmoxLogin() {
      let self = this;
      set(self, 'errors', null);
      self.apiRequest('/access/ticket').then((response) => {

        if(response.status !== 200) {
          console.log('response status !== 200 [authentication]: ', response.status );
          return;
        }

        response.json().then((json) => {
          console.log('response.json [authentication]: ', json);
          setProperties(self, {
            authToken: json.data,
            step: 2
          });
        
          self.apiRequest(`/nodes/${self.config.node}/network`).then((response) => {
            if(response.status !== 200) {
              console.log('response status !== 200 [networks]: ', response.status );
              return;
            }
            response.json().then((json) => {
              console.log('response.json [networks]: ', json);
              setProperties(self, {
                bridges: json.data,
                step: 2
              });
            });
          }).catch((err) => {
            console.log('Error getting Networks: ', err);
          });
        });

      }).catch((err) => {
        console.log('Authentication error: ', err);
      });  
    },
  },
  apiRequest: function(path) {
    let self       = this;
    let apiUrl     = `${self.config.host}:${self.config.port}/api2/json${path}`;
    let url        = `${ get(this, 'app.proxyEndpoint') }/`;
    url           += apiUrl.replace(/^http[s]?:\/\//, '');
    let params     = null;
    let headers    = new Headers();

    console.log(`api call with authToken: ${self.authToken} for command: ${path}`);
    if(self.authToken === null) {
      let username = `${self.config.user}@${self.config.realm}`;
      let password = self.config.password;
      params       = `username=${username}&password=${password}`;
      headers.append('Content-Type', 'application/x-www-form-urlencoded;charset=utf-8');
    } else {
      console.log(`Set-Cookie: PVEAuthCookie=${self.authToken.ticket};`);
      console.log(`CSRFPreventionToken: ${self.authToken.CSRFPreventionToken}`);
      console.log(`username: ${self.authToken.username}`);

      headers.append('Set-Cookie', `PVEAuthCookie=${self.authToken.ticket};`);
      headers.append("CSRFPreventionToken", self.authToken.CSRFPreventionToken);
      headers.append("username", self.authToken.username);
    }
    headers.append('Accept', 'application/json');

    return fetch(url, {
      method: 'POST',
      headers: headers,
      dataType: 'json',
      credentials: 'include',
      body: params
    });
  },
  // Any computed properties or custom logic can go here
});
