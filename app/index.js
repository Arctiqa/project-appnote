import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Dimensions, Modal, PanResponder, Pressable, SafeAreaView,
  StyleSheet, Text, TextInput, View
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

const STORAGE = '@marker-list-data-v1';
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const COLORS = ['#FF6B6B', '#FFB84D', '#5BC0EB', '#7BC950', '#A78BFA', '#FF7EB6'];

const defaultData = [
  { id: 'demo', title: 'Мои идеи', x: 0.50, y: 0.30, color: '#FF6B6B',
    items: [
      { id: '1', text: 'Попробовать новое приложение', done: false },
      { id: '2', text: 'Добавить свою первую метку', done: true }
    ]
  }
];

function makeId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function App() {
  const [markers, setMarkers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [addVisible, setAddVisible] = useState(false);
  const [name, setName] = useState('');
  const [draftItem, setDraftItem] = useState('');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE);
        setMarkers(raw ? JSON.parse(raw) : defaultData);
      } catch {
        setMarkers(defaultData);
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (hydrated) AsyncStorage.setItem(STORAGE, JSON.stringify(markers));
  }, [markers, hydrated]);

  const selectedMarker = useMemo(
    () => markers.find(m => m.id === selected) || null,
    [markers, selected]
  );

  function addMarker() {
    const clean = name.trim();
    if (!clean) return;
    const marker = {
      id: makeId(),
      title: clean,
      x: 0.5,
      y: 0.48,
      color: COLORS[markers.length % COLORS.length],
      items: []
    };
    setMarkers(prev => [...prev, marker]);
    setName('');
    setAddVisible(false);
    setSelected(marker.id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  function updateMarker(id, patch) {
    setMarkers(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m));
  }

  function addItem() {
    const clean = draftItem.trim();
    if (!clean || !selectedMarker) return;
    updateMarker(selectedMarker.id, {
      items: [...selectedMarker.items, { id: makeId(), text: clean, done: false }]
    });
    setDraftItem('');
  }

  function toggleItem(itemId) {
    if (!selectedMarker) return;
    updateMarker(selectedMarker.id, {
      items: selectedMarker.items.map(i => i.id === itemId ? { ...i, done: !i.done } : i)
    });
    Haptics.selectionAsync();
  }

  function deleteItem(itemId) {
    if (!selectedMarker) return;
    updateMarker(selectedMarker.id, {
      items: selectedMarker.items.filter(i => i.id !== itemId)
    });
  }

  function deleteMarker() {
    if (!selectedMarker) return;
    Alert.alert(
      'Удалить метку?',
      `«${selectedMarker.title}» и её список будут удалены.`,
      [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Удалить', style: 'destructive', onPress: () => {
          setMarkers(prev => prev.filter(m => m.id !== selectedMarker.id));
          setSelected(null);
        }}
      ]
    );
  }

  if (!hydrated) {
    return <View style={styles.loading}><Text style={styles.loadingText}>Загружаю…</Text></View>;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={['#FFF8EF', '#F7F1FF']} style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>МЕТКИ</Text>
            <Text style={styles.subtitle}>твои места • идеи • списки</Text>
          </View>
          <Pressable style={styles.addTop} onPress={() => setAddVisible(true)}>
            <Text style={styles.addTopText}>＋</Text>
          </Pressable>
        </View>

        <View style={styles.mapCard}>
          <View style={styles.grid}>
            {Array.from({ length: 9 }).map((_, i) => <View key={i} style={styles.dot} />)}
          </View>
          <Text style={styles.mapHint}>Нажми на +, чтобы поставить новую метку</Text>

          {markers.map(marker => (
            <Marker
              key={marker.id}
              marker={marker}
              selected={selected === marker.id}
              onPress={() => setSelected(marker.id)}
              onMove={(x, y) => updateMarker(marker.id, { x, y })}
            />
          ))}
        </View>

        <View style={styles.footer}>
          <View>
            <Text style={styles.count}>{markers.length}</Text>
            <Text style={styles.countLabel}>меток на экране</Text>
          </View>
          <Pressable style={styles.bigAdd} onPress={() => setAddVisible(true)}>
            <Text style={styles.bigAddText}>＋ Добавить метку</Text>
          </Pressable>
        </View>

        <Modal visible={!!selectedMarker} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.sheet}>
              <View style={styles.sheetHandle} />
              {selectedMarker && (
                <>
                  <View style={styles.sheetHeader}>
                    <View style={[styles.bigPin, { backgroundColor: selectedMarker.color }]}>
                      <Text style={styles.pinIcon}>●</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sheetTitle}>{selectedMarker.title}</Text>
                      <Text style={styles.sheetMeta}>{selectedMarker.items.filter(i => i.done).length}/{selectedMarker.items.length} выполнено</Text>
                    </View>
                    <Pressable onPress={deleteMarker} style={styles.trash}>
                      <Text style={styles.trashText}>⌫</Text>
                    </Pressable>
                  </View>

                  <View style={styles.inputRow}>
                    <TextInput
                      value={draftItem}
                      onChangeText={setDraftItem}
                      onSubmitEditing={addItem}
                      placeholder="Добавить пункт…"
                      placeholderTextColor="#AAA1A8"
                      style={styles.itemInput}
                      returnKeyType="done"
                    />
                    <Pressable onPress={addItem} style={styles.itemAdd}>
                      <Text style={styles.itemAddText}>+</Text>
                    </Pressable>
                  </View>

                  <View style={styles.list}>
                    {selectedMarker.items.length === 0 ? (
                      <Text style={styles.empty}>Список пока пуст. Добавь первый пункт ✨</Text>
                    ) : selectedMarker.items.map(item => (
                      <View key={item.id} style={styles.listRow}>
                        <Pressable onPress={() => toggleItem(item.id)} style={[styles.checkbox, item.done && styles.checkboxDone]}>
                          {item.done && <Text style={styles.check}>✓</Text>}
                        </Pressable>
                        <Text style={[styles.itemText, item.done && styles.itemDone]}>{item.text}</Text>
                        <Pressable onPress={() => deleteItem(item.id)} style={styles.deleteItem}>
                          <Text style={styles.deleteItemText}>×</Text>
                        </Pressable>
                      </View>
                    ))}
                  </View>

                  <Pressable style={styles.closeButton} onPress={() => setSelected(null)}>
                    <Text style={styles.closeButtonText}>Готово</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        </Modal>

        <Modal visible={addVisible} animationType="fade" transparent onRequestClose={() => setAddVisible(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.addDialog}>
              <Text style={styles.dialogTitle}>Новая метка</Text>
              <Text style={styles.dialogSub}>Дай ей короткое и понятное название</Text>
              <TextInput
                autoFocus
                value={name}
                onChangeText={setName}
                onSubmitEditing={addMarker}
                placeholder="Например: Покупки"
                placeholderTextColor="#AAA1A8"
                style={styles.nameInput}
              />
              <View style={styles.dialogActions}>
                <Pressable style={styles.cancelButton} onPress={() => { setAddVisible(false); setName(''); }}>
                  <Text style={styles.cancelText}>Отмена</Text>
                </Pressable>
                <Pressable style={styles.createButton} onPress={addMarker}>
                  <Text style={styles.createText}>Создать</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </LinearGradient>
    </SafeAreaView>
  );
}

function Marker({ marker, selected, onPress, onMove }) {
  const pan = React.useRef(new PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderMove: (_, g) => {
      const x = Math.max(0.07, Math.min(0.93, marker.x + g.dx / SCREEN_W));
      const y = Math.max(0.08, Math.min(0.90, marker.y + g.dy / (SCREEN_H * 0.52)));
      onMove(x, y);
    },
    onPanResponderRelease: () => Haptics.selectionAsync()
  })).current;

  return (
    <View
      {...pan.panHandlers}
      style={[styles.markerWrap, { left: `${marker.x * 100}%`, top: `${marker.y * 100}%` }]}
    >
      <Pressable onPress={onPress} style={styles.markerButton}>
        <View style={[styles.markerPin, { backgroundColor: marker.color }, selected && styles.markerSelected]}>
          <Text style={styles.markerDot}>●</Text>
        </View>
        <View style={[styles.markerLabel, selected && styles.markerLabelSelected]}>
          <Text numberOfLines={1} style={styles.markerLabelText}>{marker.title}</Text>
          <Text style={styles.markerLabelCount}>{marker.items.length} пунктов</Text>
        </View>
      </Pressable>
    </View>
  );
}

const comic = 'Comic Sans MS';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF8EF' },
  container: { flex: 1, paddingHorizontal: 18, paddingTop: 12 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF8EF' },
  loadingText: { fontFamily: comic, fontSize: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  brand: { fontFamily: comic, fontWeight: '900', fontSize: 29, letterSpacing: 1, color: '#29252B' },
  subtitle: { fontFamily: comic, fontSize: 13, color: '#8E858D', marginTop: -2 },
  addTop: { width: 48, height: 48, borderRadius: 17, backgroundColor: '#29252B', alignItems: 'center', justifyContent: 'center', elevation: 5 },
  addTopText: { color: '#FFF', fontSize: 29, fontWeight: '300', marginTop: -2 },
  mapCard: { flex: 1, minHeight: 420, borderRadius: 30, backgroundColor: '#FFFDF9', overflow: 'hidden', borderWidth: 1, borderColor: '#EEE6DD', elevation: 4, position: 'relative' },
  grid: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', flexWrap: 'wrap', opacity: 0.22, padding: 28, alignContent: 'space-between', justifyContent: 'space-between' },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#B7ADB5' },
  mapHint: { position: 'absolute', top: 15, alignSelf: 'center', fontFamily: comic, fontSize: 12, color: '#A69BA2', backgroundColor: '#FFFDF9CC', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12 },
  markerWrap: { position: 'absolute', transform: [{ translateX: -40 }, { translateY: -23 }], zIndex: 5 },
  markerButton: { alignItems: 'center' },
  markerPin: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: '#FFFDF9', elevation: 5 },
  markerSelected: { transform: [{ scale: 1.18 }], borderColor: '#29252B' },
  markerDot: { color: '#FFF', fontSize: 12 },
  markerLabel: { marginTop: 4, maxWidth: 120, backgroundColor: '#FFF', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 11, borderWidth: 1, borderColor: '#EEE6DD', elevation: 2 },
  markerLabelSelected: { borderColor: '#29252B' },
  markerLabelText: { fontFamily: comic, fontWeight: '800', fontSize: 12, color: '#29252B' },
  markerLabelCount: { fontFamily: comic, fontSize: 9, color: '#9B9098' },
  footer: { paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  count: { fontFamily: comic, fontSize: 24, fontWeight: '900', color: '#29252B' },
  countLabel: { fontFamily: comic, fontSize: 11, color: '#948A91' },
  bigAdd: { backgroundColor: '#29252B', paddingHorizontal: 18, paddingVertical: 13, borderRadius: 17 },
  bigAddText: { color: '#FFF', fontFamily: comic, fontWeight: '800', fontSize: 14 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(34,29,34,.32)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFDF9', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 20, paddingBottom: 28, maxHeight: '86%' },
  sheetHandle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: '#DDD4D9', marginBottom: 18 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  bigPin: { width: 50, height: 50, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  pinIcon: { color: '#FFF', fontSize: 20 },
  sheetTitle: { fontFamily: comic, fontSize: 23, fontWeight: '900', color: '#29252B' },
  sheetMeta: { fontFamily: comic, fontSize: 12, color: '#948A91', marginTop: 2 },
  trash: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#F7EAEA', alignItems: 'center', justifyContent: 'center' },
  trashText: { color: '#D45C5C', fontSize: 21 },
  inputRow: { flexDirection: 'row', gap: 9, marginBottom: 14 },
  itemInput: { flex: 1, backgroundColor: '#F6F1ED', borderRadius: 15, paddingHorizontal: 15, height: 49, fontFamily: comic, fontSize: 14, color: '#29252B' },
  itemAdd: { width: 49, height: 49, borderRadius: 15, backgroundColor: '#29252B', alignItems: 'center', justifyContent: 'center' },
  itemAddText: { color: '#FFF', fontSize: 27, fontWeight: '300' },
  list: { maxHeight: 300 },
  empty: { fontFamily: comic, color: '#9B9098', textAlign: 'center', padding: 25, fontSize: 14 },
  listRow: { flexDirection: 'row', alignItems: 'center', minHeight: 55, borderBottomWidth: 1, borderBottomColor: '#F0E9E3', gap: 11 },
  checkbox: { width: 26, height: 26, borderRadius: 9, borderWidth: 2, borderColor: '#C9BEC5', alignItems: 'center', justifyContent: 'center' },
  checkboxDone: { backgroundColor: '#7BC950', borderColor: '#7BC950' },
  check: { color: '#FFF', fontWeight: '900', fontSize: 15 },
  itemText: { flex: 1, fontFamily: comic, fontSize: 15, color: '#39333A' },
  itemDone: { textDecorationLine: 'line-through', color: '#AAA1A8' },
  deleteItem: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  deleteItemText: { color: '#B5AAB1', fontSize: 23 },
  closeButton: { height: 50, borderRadius: 16, backgroundColor: '#29252B', alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  closeButtonText: { color: '#FFF', fontFamily: comic, fontWeight: '900', fontSize: 15 },
  addDialog: { backgroundColor: '#FFFDF9', margin: 22, borderRadius: 28, padding: 22, elevation: 10 },
  dialogTitle: { fontFamily: comic, fontSize: 25, fontWeight: '900', color: '#29252B' },
  dialogSub: { fontFamily: comic, fontSize: 13, color: '#948A91', marginTop: 4, marginBottom: 16 },
  nameInput: { height: 52, borderRadius: 16, backgroundColor: '#F6F1ED', paddingHorizontal: 15, fontFamily: comic, fontSize: 16, color: '#29252B' },
  dialogActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  cancelButton: { flex: 1, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1ECE8' },
  cancelText: { fontFamily: comic, fontWeight: '800', color: '#645B62' },
  createButton: { flex: 1, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#29252B' },
  createText: { fontFamily: comic, fontWeight: '800', color: '#FFF' }
});
