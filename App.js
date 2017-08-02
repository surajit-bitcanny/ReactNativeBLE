import React, {Component} from 'react';
import {
    AppRegistry,
    StyleSheet,
    Text,
    View,
    TouchableHighlight,
    NativeModules,
    Platform,
    PermissionsAndroid,
    ListView,
    ScrollView,
    FlatList,
    ToastAndroid,
    DeviceEventEmitter
} from 'react-native';
import Dimensions from 'Dimensions';
import TimerMixin from 'react-timer-mixin';
import reactMixin from 'react-mixin';

global.Buffer = require('buffer').Buffer;

const window = Dimensions.get('window');
const ds = new ListView.DataSource({rowHasChanged: (r1, r2) => r1 !== r2});

var noble = require('react-native-ble');

var defaultState = {
    scanning: false,
    peripherals: new Map(),
    notify: false,
    peripheralUuid: null //connected periferal id
}

var serviceUUIDs = ['ec00']; // default: [] => all
var characteristicUUIDs = ['ec0e'];
//var UUID_BASE = "0000XXXX-0000-1000-8000-00805f9b34fb";
var UUID_BASE = "0000XXXX00001000800000805f9b34fb";

var getProperUUID = function (uuid) {
    var myUUID = uuid;
    if(myUUID.length == 4){
        myUUID = UUID_BASE.replace("XXXX", uuid);
    }
    return myUUID;
}

export default class App extends Component {
    constructor() {
        super()

        this.state = defaultState

    }

    componentDidMount() {
        this.showMessage("componentDidMount");
        this.checkPermission();
        this.setListeners();
    }

    setListeners() {
        noble.on('scanStart', this.onScanStarted.bind(this));
        noble.on('scanStop', this.onScanStopped.bind(this));
        noble.on('stateChange', this.onStateChanged.bind(this));
        noble.on('discover', this.onPeriferalDiscovered.bind(this));
        noble.on('warning', (message)=>{this.showMessage("Warning : "+message)});
        noble.on('characteristicsDiscover', (data)=>{this.showMessage(data)});

        noble.on('connect', ()=>{this.showMessage("Connected............ : ")});
        noble.on('disconnect', ()=>{this.showMessage("Disconnected............. : ")});
    }

    checkPermission() {
        if (Platform.OS === 'android' && Platform.Version >= 23) {
            PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION).then((result) => {
                if (result) {
                    this.showMessage("Permission is OK");
                } else {
                    PermissionsAndroid.requestPermission(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION).then((result) => {
                        if (result) {
                            this.showMessage("User accept");
                        } else {
                            this.showMessage("User refuse");
                        }
                    });
                }
            });
        }
    }

    render() {
        const list = Array.from(this.state.peripherals.values());
        const dataSource = ds.cloneWithRows(list);


        return (
            <View style={styles.container}>
                <TouchableHighlight style={{marginTop: 40, margin: 20, padding: 20, backgroundColor: '#ccc'}}
                                    onPress={() => this.startStopScan()}>
                    <Text>Scan Bluetooth ({this.state.scanning ? 'on' : 'off'})</Text>
                </TouchableHighlight>

                <View style={{flexDirection: 'row'}}>

                    <TouchableHighlight style={{marginTop: 40, margin: 20, padding: 20, backgroundColor: '#ccc'}}
                                        onPress={() => this.readData()}>
                        <Text>Read</Text>
                    </TouchableHighlight>

                    <TouchableHighlight style={{marginTop: 40, margin: 20, padding: 20, backgroundColor: '#ccc'}}
                                        onPress={() => this.writeData()}>
                        <Text>Write</Text>
                    </TouchableHighlight>

                    <TouchableHighlight style={{marginTop: 40, margin: 20, padding: 20, backgroundColor: '#ccc'}}
                                        onPress={() => this.startNotify()}>
                        <Text>Notify ({this.state.notify ? 'on' : 'off'})</Text>
                    </TouchableHighlight>

                </View>


                <ScrollView style={styles.scroll}>
                    {(list.length == 0) &&
                    <View style={{flex: 1, margin: 20}}>
                        <Text style={{textAlign: 'center'}}>No peripherals</Text>
                    </View>
                    }
                    <FlatList
                        data={list}
                        keyExtractor={(item, index) => index}
                        renderItem={({item}) => {
                            const color = (item.state === 'connected') ? 'green' : '#fff';
                            return (
                                <TouchableHighlight onPress={() => this.onItemClick(item)}>
                                    <View style={[styles.row, {backgroundColor: color}]}>
                                        <Text style={{
                                            fontSize: 12,
                                            textAlign: 'center',
                                            color: '#333333',
                                            padding: 10
                                        }}>{item.advertisement.localName}</Text>
                                        <Text style={{
                                            fontSize: 8,
                                            textAlign: 'center',
                                            color: '#333333',
                                            padding: 10
                                        }}>{item.id}</Text>
                                    </View>
                                </TouchableHighlight>
                            );
                        }}
                    />
                </ScrollView>
            </View>
        );
    }


    /**
     *
     * @param peripheral object
     * {
          "id": "06:CE:09:41:B3:E7",
          "address": "06:CE:09:41:B3:E7",
          "addressType": "unknown",
          "connectable": true,
          "advertisement": {
            "localName": "echo",
            "txPowerLevel": -2147483648,
            "manufacturerData": null,
            "serviceData": [

            ],
            "serviceUuids": [
              "0000ec0000001000800000805f9b34fb"
            ]
          },
          "rssi": -34,
          "state": "disconnected"
        }
     */

    onPeriferalDiscovered(peripheral) {
        this.updatePeripheral(peripheral);
        this.showMessage('discover: ' + peripheral);
    }

    componentWillUnmount() {
        this.showMessage("componentWillUnmount");
    }


    showMessage(msg,showToast = false) {
        console.log(msg);
        if(showToast)
            ToastAndroid.showWithGravity(msg, ToastAndroid.SHORT, ToastAndroid.BOTTOM);
    }

    disconnectPeripheral(peripheral){
        this.showMessage("disconnectPeripheral "+ peripheral.id);
        peripheral.once('disconnect', (error)=> {
            if(error)
            {
                this.showMessage('peripheral.disconnected error: ');
                this.showMessage(error);
                return;
            }
            this.showMessage('peripheral.disconnected: ' + peripheral.address);
            this.updatePeripheral(peripheral);

        });
        peripheral.disconnect();
    }

    setCurrentPeripheral(peripheralUuid){
        this.setState({peripheralUuid:peripheralUuid});
    }

    getCurrentPeripheral(){
        return this.state.peripherals.get(this.state.peripheralUuid);
    }

    connectPeripheral(peripheral){
        this.showMessage("connectPeripheral " + peripheral.id);

        peripheral.once('connect', (error)=> {
            if(error)
            {
                this.showMessage('peripheral.connect error: ');
                this.showMessage(error);
                return;
            }
            this.setCurrentPeripheral(peripheral.id);
            this.showMessage('peripheral.connect: ' + peripheral.address);
            this.updatePeripheral(peripheral);
            peripheral.discoverServices();
            //this.discoverAllServiceAndCharacteristics(peripheral);
        });
        peripheral.once('servicesDiscover', (services)=> {
            this.onServicesDiscovered(peripheral,services);
        });
        peripheral.once('rssiUpdate', function (rssi) {
            this.showMessage('--- rssiUpdate ' + rssi);
        });
        peripheral.connect();
    }

    discoverAllServiceAndCharacteristics(peripheral){
        peripheral.discoverAllServicesAndCharacteristics((error, services, characteristics)=>{
            this.showMessage(services.length + ' services discovered!!!! for '+ peripheral.id);
            this.showMessage(characteristics.length + ' characteristics discovered!!!! for '+ peripheral.id);
        });
    }

    onServicesDiscovered(peripheral,services){
        this.showMessage(services.length + ' services discovered!!!! for '+ peripheral.id);
        let service = this.findService(peripheral,getProperUUID(serviceUUIDs[0]));
        if(service){
            this.showMessage("Found proper serviceeeee");

            service.discoverCharacteristics([getProperUUID(characteristicUUIDs[0])], (error, characteristics)=> {
                if(error)
                {
                    this.showMessage('service.discoverCharacteristics error: ');
                    this.showMessage(error);
                    return;
                }
                this.onCharacteristicsDiscovered(service,characteristics);
            });

            /*service.once('characteristicsDiscover', (characteristics)=>{
                this.showMessage('  ---- number of characteristics = ' + characteristics.length + ',   ' + peripheral.address,true);
            });
            service.discoverCharacteristics([getProperUUID('ec0e')]);*/
        }

    }

    onCharacteristicsDiscovered(service,characteristics){
        console.log(characteristics.length + ' characteristics found for ' + service.uuid);
        //let peripheral = this.getCurrentPeripheral();
        for (var i in characteristics) {
            console.log('  ' + i + ' uuid: ' + characteristics[i].uuid);
        }
    }

    getCharacteristics(){
        let peripheral = this.getCurrentPeripheral();
        let characteristics = this.findCharacteristics(peripheral,getProperUUID(serviceUUIDs[0]),getProperUUID(characteristicUUIDs[0]));
        if(characteristics) {
            this.showMessage("Found characteristics....." + characteristics);
        }else{
            this.showMessage("Characteristics "+characteristicUUIDs[0]+" not found",true);
        }
        return characteristics;
    }

    startNotify() {
        let characteristics = this.getCharacteristics();
        if(characteristics){
            let notify = this.state.notify;
            if(notify){
                characteristics.unsubscribe((error)=>{
                    if(error){
                        this.showMessage("Notification unsubscribe error");
                        this.showMessage(error,true);
                        return;
                    }
                    characteristics.removeListener('data',this.notificationCallback);
                    this.showMessage("Notification unsubscribed");
                    this.setState({notify : false});
                });
            } else{
                this.notificationCallback = this.onNotificationReceived.bind(this);
                characteristics.on('data',this.notificationCallback);
                characteristics.subscribe((error)=>{
                    if(error){
                        this.showMessage("Notification subscribe error");
                        this.showMessage(error,true);
                        return;
                    }
                    this.showMessage("Notification subscribed");
                    this.setState({notify : true});
                });
            }
        }
    }

    onNotificationReceived(data, isNotification){
        if(isNotification){
            this.showMessage("New notificationn received----------------------");
            this.showMessage(data.toString("ascii"),true);
        }
    }

    readData(){
        let characteristics = this.getCharacteristics();
        if(characteristics){
            characteristics.read((error,data)=>{
                if(error){
                    this.showMessage("Read error---------------------");
                    this.showMessage(error,true);
                    return;
                }

                this.showMessage("Read success-----------------------");
                this.showMessage(data.toString("ascii"));
            });
        }
    }

    writeData(){
        let characteristics = this.getCharacteristics();
        if(characteristics){
            let data = "{\n" +
                "  \"state\": {\n" +
                "    \"desired\": {\n" +
                "      \"settings\": {\n" +
                "        \"type\": \"hub\",\n" +
                "        \"hub_id\": \"7330620e-422b-49ac-90ac-2098349e74c7\",\n" +
                "        \"wifi_ssid\": \"\",\n" +
                "        \"wifi_password\": \"\",\n" +
                "        \"apn\": \"\",\n" +
                "        \"rently_batch_code_duration\": 1440,\n" +
                "        \"time_zone\": \"America/New_York\",\n" +
                "        \"sensors\": \"enable\",\n" +
                "        \"devices\": [],\n" +
                "        \"schedule\": \"4e4585c0-cffb-48c6-a18f-c9d17f6f1a50|2017-07-20T10:48:47Z\",\n" +
                "        \"monitoring\": \"arm_out\",\n" +
                "        \"max_ui_slots\": 71,\n" +
                "        \"latitude\": \"22.54144273140893\",\n" +
                "        \"longitude\": \"88.34919823037352\",\n" +
                "        \"schedules\": {}\n" +
                "      },\n" +
                "      \"thing_name\": \"30012\",\n" +
                "      \"commands\": {}\n" +
                "    },\n" +
                "    \"reported\": {\n" +
                "      \"thing_name\": \"30012\",\n" +
                "      \"settings\": {\n" +
                "        \"type\": \"hub\",\n" +
                "        \"hub_id\": \"7330620e-422b-49ac-90ac-2098349e74c7\",\n" +
                "        \"wifi_ssid\": \"\",\n" +
                "        \"wifi_password\": \"\",\n" +
                "        \"apn\": \"\",\n" +
                "        \"rently_batch_code_duration\": 1440,\n" +
                "        \"time_zone\": \"America/New_York\",\n" +
                "        \"sensors\": \"enable\",\n" +
                "        \"devices\": [],\n" +
                "        \"schedule\": \"4e4585c0-cffb-48c6-a18f-c9d17f6f1a50|2017-07-20T10:48:47Z\",\n" +
                "        \"monitoring\": \"arm_out\",\n" +
                "        \"max_ui_slots\": 71,\n" +
                "        \"latitude\": \"22.54144273140893\",\n" +
                "        \"longitude\": \"88.34919823037352\",\n" +
                "        \"schedules\": {}\n" +
                "      },\n" +
                "      \"commands\": {},\n" +
                "      \"notification\": {},\n" +
                "      \"status\": {\n" +
                "        \"heartBeat\": \"2017-08-02T07:52:19.973Z\",\n" +
                "        \"lastRefreshDate\": \"2017-07-28T05:13:48.270Z\",\n" +
                "        \"fwVer\": \"1.2.3.10\",\n" +
                "        \"network_type\": \"ethernet\",\n" +
                "        \"battery\": \"low\"\n" +
                "      }\n" +
                "    }\n" +
                "  },\n" +
                "  \"version\": 73112,\n" +
                "  \"timestamp\": 1501661553\n" +
                "}";

            characteristics.write(Buffer.from("Hiiiiiii"),false,(error)=>{
                if(error){
                    this.showMessage("Write error--------------------");
                    this.showMessage(error,true);
                    return;
                }

                this.showMessage("Write success-----------------------");
            });
        }
    }

    findCharacteristics(peripheral,serviceUUID,characteristicsUUID){
        let service = this.findService(peripheral,serviceUUID);
        let characteristics;
        for(let i=0;i<service.characteristics.length;i++){
            let char = service.characteristics[i];
            //this.showMessage("Checking characteristics uuid "+char.uuid);
            if(char.uuid === characteristicsUUID){
                characteristics = char;
                break;
            }
        }
        return characteristics;
    }

    findService(peripheral,serviceUUID){
        let service;
        for(let i=0;i<peripheral.services.length;i++){
            let srv = peripheral.services[i];
            let uuid = srv.uuid;
            //this.showMessage("Checking service uuid "+uuid);
            if(uuid === serviceUUID){
                service = srv;
                break;
            }
        }
        return service;
    }

    updatePeripheral(peripheral){
        this.showMessage("updatePeripheral");
        let peripherals = this.state.peripherals;
        peripherals.set(peripheral.id,peripheral);
        this.setState(peripherals);
    }

    onItemClick(peripheral) {
        if(peripheral){
            if(peripheral.state === 'connected'){
                this.disconnectPeripheral(peripheral);
            } else {
                this.connectPeripheral(peripheral);
            }
        }
    }

    startStopScan() {
        if (!this.state.scanning) {
            noble.startScanning();
        } else {
            noble.stopScanning();
        }
    }

    onScanStarted() {
        this.showMessage("onScanStarted");
        this.state.peripherals.clear();
        this.setState({scanning: true})
        setTimeout(this.startStopScan.bind(this), 2000);
    }

    onScanStopped() {
        this.showMessage("onScanStopped");
        this.setState({scanning: false})
    }

    onStateChanged(state) {
        // 'unknown', 'resetting', 'unsupported', 'unauthorized', 'poweredOff', 'poweredOn'
        this.showMessage("onStateChanged => "+state);
    }
}
reactMixin(App.prototype, TimerMixin);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFF',
        width: window.width,
        height: window.height
    },
    scroll: {
        flex: 1,
        backgroundColor: '#f0f0f0',
        margin: 10,
    },
    row: {
        margin: 10
    },
});
