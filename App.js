import React, {Component} from 'react';
import {
    AppRegistry,
    StyleSheet,
    Text,
    View,
    TouchableHighlight,
    NativeAppEventEmitter,
    NativeEventEmitter,
    NativeModules,
    Platform,
    PermissionsAndroid,
    ListView,
    ScrollView,
    FlatList,
    ToastAndroid
} from 'react-native';
import Dimensions from 'Dimensions';
import BleManager from 'react-native-ble-manager';
import TimerMixin from 'react-timer-mixin';
import reactMixin from 'react-mixin';

const window = Dimensions.get('window');
const ds = new ListView.DataSource({rowHasChanged: (r1, r2) => r1 !== r2});

const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);

export default class App extends Component {
    constructor() {
        super()

        this.state = {
            scanning: false,
            peripherals: new Map(),
            notify: false
        }

        this.handleDiscoverPeripheral = this.handleDiscoverPeripheral.bind(this);
        this.handleStopScan = this.handleStopScan.bind(this);
        this.handleUpdateValueForCharacteristic = this.handleUpdateValueForCharacteristic.bind(this);
        this.handleDisconnectedPeripheral = this.handleDisconnectedPeripheral.bind(this);
    }

    /*BleManagerDiscoverPeripheral
    BleManagerDisconnectPeripheral
    BleManagerConnectPeripheral
    BleManagerDidUpdateState
    BleManagerStopScan
    BleManagerDidUpdateValueForCharacteristic*/

    componentDidMount() {
        BleManager.start({showAlert: false, allowDuplicates: false});

        this.handlerDiscover = bleManagerEmitter.addListener('BleManagerDiscoverPeripheral', this.handleDiscoverPeripheral);
        this.handlerStop = bleManagerEmitter.addListener('BleManagerStopScan', this.handleStopScan);
        this.handlerDisconnect = bleManagerEmitter.addListener('BleManagerDisconnectPeripheral', this.handleDisconnectedPeripheral);
        this.handlerUpdate = bleManagerEmitter.addListener('BleManagerDidUpdateValueForCharacteristic', this.handleUpdateValueForCharacteristic);


        if (Platform.OS === 'android' && Platform.Version >= 23) {
            PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION).then((result) => {
                if (result) {
                    console.log("Permission is OK");
                } else {
                    PermissionsAndroid.requestPermission(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION).then((result) => {
                        if (result) {
                            console.log("User accept");
                        } else {
                            console.log("User refuse");
                        }
                    });
                }
            });
        }
    }

    componentWillUnmount() {
        this.handlerDiscover.remove();
        this.handlerStop.remove();
        this.handlerDisconnect.remove();
        this.handlerUpdate.remove();
    }


    /*
    {
      "peripheral" : "mac address"
    }
     */
    handleDisconnectedPeripheral(data) {
        let peripherals = this.state.peripherals;
        let peripheral = peripherals.get(data.peripheral);//"mac address is passed in 'peripheral' key"
        if (peripheral) {
            peripheral.connected = false;
            peripherals.set(peripheral.id, peripheral);
            this.setState({peripherals});
        }
        this.showMessage('Disconnected from ' + data.peripheral);
    }


    /*
    {
      "peripheral" : "mac id",
      "characteristic" : "characteristic UUID",
      "service" : "service UUID",
      "value" : [] //hex value of byte[]
    }
     */
    handleUpdateValueForCharacteristic(data) {
        console.log('Received data from ' + data.peripheral + ' characteristic ' + data.characteristic, data.value);
    }

    handleStopScan() {
        this.showMessage('Scan is stopped');
        this.setState({scanning: false, notify: false});
    }

    startScan() {
        if (!this.state.scanning) {
            BleManager.scan([], 10, true).then((results) => {
                this.showMessage('Scanning...');
                this.setState({scanning: true});
            });
        }
    }


    /*
    {
      "name" : "device name",
      "id"  : "mac id",
      "rssi" : 23,
      "advertising" : {
        "CDVType" : "ArrayBuffer",
        "data" : "Base 64 encoded data",
        "bytes" : []
      }
    }
    */

    handleDiscoverPeripheral(peripheral) {
        var peripherals = this.state.peripherals;
        if (!peripherals.has(peripheral.id)) {
            console.log('Got ble peripheral', peripheral);
            peripherals.set(peripheral.id, peripheral);
            this.setState({peripherals})
        }
    }

    test(peripheral) {
        this.selectedPeriferal = peripheral;
        if (peripheral) {
            if (peripheral.connected) {
                BleManager.disconnect(peripheral.id);
            } else {
                BleManager.connect(peripheral.id).then(() => {
                    let peripherals = this.state.peripherals;
                    let p = peripherals.get(peripheral.id);
                    if (p) {
                        p.connected = true;
                        peripherals.set(peripheral.id, p);
                        this.setState({peripherals});
                    }
                    this.showMessage('Connected to ' + peripheral.id + ' (' + peripheral.name + ')');


                    this.setTimeout(() => {


                        BleManager.retrieveServices(peripheral.id).then((peripheralData) => {
                            console.log('Retrieved peripheral services', peripheralData);

                            /*
                            Sample Data
                            {
                                characteristics: [
                                  {
                                    descriptors: [
                                      Object
                                    ],
                                    properties: [
                                      Object
                                    ],
                                    characteristic: '2a37',
                                    service: '180d'
                                  }
                                ],
                                services: [
                                  {
                                    uuid: '1800'
                                  }
                                ],
                                rssi: -45,
                                advertising: {
                                  bytes: [],
                                  data: 'AgoMBglQaUxFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
                                  CDVType: 'ArrayBuffer'
                                },
                                id: 'B8:27:EB:55:65:13',
                                name: 'PiLE'
                              }
                             */

                            BleManager.readRSSI(peripheral.id).then((rssi) => {
                                this.showMessage('Retrieved actual RSSI value', rssi);
                            });


                        });

                    }, 900);


                }).catch((error) => {
                    this.showMessage('Connection error', error);
                });
            }
        }
    }

    showMessage(msg) {
        console.log(msg);
        ToastAndroid.showWithGravity(msg, ToastAndroid.SHORT, ToastAndroid.BOTTOM);
    }

    startRead() {
        if (this.selectedPeriferal) {

            BleManager.read(this.selectedPeriferal.id, '180D', '2A38')
                .then((readData) => {
                    // Success code
                    console.log('Read: ' + readData);
                })
                .catch((error) => {
                    // Failure code
                    this.showMessage(error);
                });
        } else{
            this.showMessage("Periferal is not selected.");
        }
    }

    startWrite() {
        if (this.selectedPeriferal) {
            let messages = [[0, 7, 2, 52, 2, 19, 181], [0, 7, 2, 103, 2, 47, 69], [0, 7, 2, 32, 2, 28, 181], [0, 7, 2, 120, 2, 39, 117]];
            let message = messages[Math.floor(Math.random() * 3)];
            //let message = messages[0];
            console.log(message);
            BleManager.write(this.selectedPeriferal.id, '180D', '2A39', message,2)
                .then(() => {
                    this.showMessage('Write confirmed');
                })
                .catch((error) => {
                    // Failure code
                    this.showMessage(error);
                });
        }else{
            this.showMessage("Periferal is not selected.");
        }
    }

    startNotify() {
        if (this.selectedPeriferal) {
            if (!this.state.notify) {
                BleManager.startNotification(this.selectedPeriferal.id, '180D', '2A37').then(() => {
                    this.showMessage('Started notification on ' + this.selectedPeriferal.id);
                    this.setState({notify: true})
                }).catch((error) => {
                    this.showMessage('Notification error', error);
                    this.setState({notify: false})
                });
            } else {
                BleManager.stopNotification(this.selectedPeriferal.id, '180D', '2A37').then(() => {
                    this.showMessage('Notification turned off ' + this.selectedPeriferal.id);
                    this.setState({notify: false})
                }).catch((error) => {
                    this.showMessage('Notification error', error);
                    this.setState({notify: false})
                });
            }
        } else{
            this.showMessage("Periferal is not selected.");
        }
    }

    render() {
        const list = Array.from(this.state.peripherals.values());
        const dataSource = ds.cloneWithRows(list);


        return (
            <View style={styles.container}>
                <TouchableHighlight style={{marginTop: 40, margin: 20, padding: 20, backgroundColor: '#ccc'}}
                                    onPress={() => this.startScan()}>
                    <Text>Scan Bluetooth ({this.state.scanning ? 'on' : 'off'})</Text>
                </TouchableHighlight>

                <View style={{flexDirection: 'row'}}>

                    <TouchableHighlight style={{marginTop: 40, margin: 20, padding: 20, backgroundColor: '#ccc'}}
                                        onPress={() => this.startRead()}>
                        <Text>Read</Text>
                    </TouchableHighlight>

                    <TouchableHighlight style={{marginTop: 40, margin: 20, padding: 20, backgroundColor: '#ccc'}}
                                        onPress={() => this.startWrite()}>
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
                        renderItem={({item}) => {
                            const color = item.connected ? 'green' : '#fff';
                            return (
                                <TouchableHighlight onPress={() => this.test(item)}>
                                    <View style={[styles.row, {backgroundColor: color}]}>
                                        <Text style={{
                                            fontSize: 12,
                                            textAlign: 'center',
                                            color: '#333333',
                                            padding: 10
                                        }}>{item.name}</Text>
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
