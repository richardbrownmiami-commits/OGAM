import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, StyleSheet, Image, Modal, TextInput, FlatList, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';

export default function SettingsScreen() {
  const [githubUser, setGithubUser] = useState<any>(null);
  const [githubToken, setGithubToken] = useState<string|null>(null);
  const [showPatModal, setShowPatModal] = useState(false);
  const [patInput, setPatInput] = useState('');
  const [toggles, setToggles] = useState({ internet: true, webSearch: true, ghClone: false, remoteModels: false, ghControl: true, listRepos: true, createPR: true, createIssue: false, clone: false, ghost: true, worker: true, boss: true, workflow: true, multiAgent: false });
  const [logs, setLogs] = useState<any[]>([]);
  const [basementVisible, setBasementVisible] = useState(false);
  const [taskStatus, setTaskStatus] = useState<any>(null);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    const token = await AsyncStorage.getItem('github_token');
    const username = await AsyncStorage.getItem('github_username');
    if (token) setGithubToken(token);
    if (username && token) {
      try {
        const r = await fetch('https://api.github.com/user', { headers: { Authorization: `token ${token}` } });
        const u = await r.json();
        if (u.login) setGithubUser(u);
      } catch {}
    }
    const saved = await AsyncStorage.getItem('ogam_toggles');
    if (saved) setToggles(JSON.parse(saved));
    try {
      const p = RNFS.DocumentDirectoryPath + '/actions.json';
      if (await RNFS.exists(p)) { const c = await RNFS.readFile(p, 'utf8'); setLogs(JSON.parse(c).slice(-50).reverse()); }
      const tp = RNFS.DocumentDirectoryPath + '/task_status.json';
      if (await RNFS.exists(tp)) { const tc = await RNFS.readFile(tp, 'utf8'); setTaskStatus(JSON.parse(tc)); }
    } catch {}
  };

  const saveToggles = async (n:any) => { setToggles(n); await AsyncStorage.setItem('ogam_toggles', JSON.stringify(n)); };

  const savePat = async () => {
    const pat = patInput.trim();
    if (!pat) return;
    if (!pat.startsWith('ghp_') && !pat.startsWith('github_pat_') && !pat.startsWith('gh_')) {
      Alert.alert('Invalid', 'Token must start with ghp_, github_pat_, or gh_'); return;
    }
    try {
      const res = await fetch('https://api.github.com/user', { headers: { Authorization: `token ${pat}` } });
      const user = await res.json();
      if (!user.login) { Alert.alert('Failed', user.message || 'Invalid token'); return; }
      // SAVE AS SSECRET - only on phone, never in repo
      await AsyncStorage.setItem('github_token', pat);
      await AsyncStorage.setItem('github_username', user.login);
      setGithubUser(user); setGithubToken(pat); setShowPatModal(false); setPatInput('');
      Alert.alert('Connected', `@${user.login} connected`);
    } catch (e) { Alert.alert('Error', 'Check internet'); }
  };

  const disconnect = async () => {
    await AsyncStorage.removeItem('github_token');
    await AsyncStorage.removeItem('github_username');
    setGithubUser(null); setGithubToken(null);
  };

  const ToggleRow = ({ label, value, onValueChange, isSub }: any) => (
    <View style={[styles.toggleRow, isSub && styles.subRow]}>
      <Text style={[styles.toggleLabel, isSub && styles.subLabel]}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ true: '#22c55e' }} thumbColor="#fff" />
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={styles.headerTitle}>OGAM AI STUDIO Settings</Text>

        {/* GITHUB PAT CARD */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{githubUser ? 'GitHub Connected' : 'Connect GitHub'}</Text>
            {githubUser && <View style={styles.activeBadge}><Text style={styles.activeText}>● Active</Text></View>}
          </View>
          {githubUser ? (
            <View style={styles.githubRow}>
              <Image source={{ uri: githubUser.avatar_url }} style={styles.avatar} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.username}>@{githubUser.login}</Text>
                <Text style={styles.subText}>{githubUser.public_repos} repos • PAT</Text>
              </View>
              <TouchableOpacity style={styles.disconnectBtn} onPress={disconnect}><Text style={styles.redText}>Disconnect</Text></TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.connectBtn} onPress={() => setShowPatModal(true)}>
              <Text style={styles.connectText}>🔗 Connect with GitHub PAT</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.sectionLabel}>INTERNET CONTROL</Text>
        <View style={styles.card}>
          <ToggleRow label="🌐 Internet Control" value={toggles.internet} onValueChange={(v:any)=>saveToggles({...toggles, internet:v})} />
          <ToggleRow label="🔍 Web Search" value={toggles.webSearch} onValueChange={(v:any)=>saveToggles({...toggles, webSearch:v})} isSub />
          <ToggleRow label="📥 GitHub Clone" value={toggles.ghClone} onValueChange={(v:any)=>saveToggles({...toggles, ghClone:v})} isSub />
        </View>

        <Text style={styles.sectionLabel}>GITHUB CONTROL</Text>
        <View style={styles.card}>
          <ToggleRow label="GitHub Control" value={toggles.ghControl} onValueChange={(v:any)=>saveToggles({...toggles, ghControl:v})} />
          <ToggleRow label="List Repos" value={toggles.listRepos} onValueChange={(v:any)=>saveToggles({...toggles, listRepos:v})} isSub />
          <ToggleRow label="Create PR" value={toggles.createPR} onValueChange={(v:any)=>saveToggles({...toggles, createPR:v})} isSub />
          <ToggleRow label="Create Issue" value={toggles.createIssue} onValueChange={(v:any)=>saveToggles({...toggles, createIssue:v})} isSub />
          <ToggleRow label="Clone" value={toggles.clone} onValueChange={(v:any)=>saveToggles({...toggles, clone:v})} isSub />
        </View>

        <Text style={styles.sectionLabel}>HEARTBEAT & GHOST</Text>
        <View style={styles.card}>
          <ToggleRow label="Heartbeat & Ghost Control" value={toggles.ghost} onValueChange={(v:any)=>saveToggles({...toggles, ghost:v})} />
          {taskStatus?.status==='WORKING' && <Text style={styles.working}>WORKING • {taskStatus.progress||45}% - {taskStatus.current||'cloning...'}</Text>}
          <ToggleRow label="Worker Heartbeat" value={toggles.worker} onValueChange={(v:any)=>saveToggles({...toggles, worker:v})} isSub />
          <ToggleRow label="Boss Heartbeat" value={toggles.boss} onValueChange={(v:any)=>saveToggles({...toggles, boss:v})} isSub />
        </View>

        <Text style={styles.sectionLabel}>LOG UI</Text>
        <View style={[styles.card, { backgroundColor: '#111' }]}>
          <FlatList data={logs.length?logs:[{msg:'scaffold created',ok:true},{msg:'clone failed - no internet',ok:false}]} 
            renderItem={({item}:any)=><Text style={{color:item.ok?'#22c55e':'#ef4444',fontFamily:'monospace',fontSize:12}}>{item.ok?'✓':'✗'} {item.msg||item.action}</Text>} keyExtractor={(_,i)=>i.toString()} scrollEnabled={false} />
          <TouchableOpacity style={styles.basementBtn} onPress={()=>setBasementVisible(true)}><Text style={{color:'#fff',fontWeight:'700'}}>🏚️ App Basement</Text></TouchableOpacity>
        </View>

        <Text style={styles.footer}>Terms • Privacy • About • v1.4.2 (42)</Text>
      </ScrollView>

      {/* PAT MODAL - SSECRET INPUT */}
      <Modal visible={showPatModal} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Enter GitHub PAT</Text>
            <Text style={styles.modalSub}>Create at: github.com → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate → check repo. This token is saved only on this device, never in repo.</Text>
            <TextInput value={patInput} onChangeText={setPatInput} placeholder="ghp_xxxxxxxxxxxxxxxx" placeholderTextColor="#555" style={styles.input} secureTextEntry autoCapitalize="none" autoCorrect={false} />
            <TouchableOpacity style={styles.connectBtn} onPress={savePat}><Text style={styles.connectText}>Save Secret & Connect</Text></TouchableOpacity>
            <TouchableOpacity onPress={()=>setShowPatModal(false)} style={{alignItems:'center',marginTop:12}}><Text style={{color:'#888'}}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* BASEMENT MODAL INSIDE SAME FILE */}
      <Modal visible={basementVisible} animationType="slide">
        <View style={[styles.container,{padding:16}]}>
          <View style={{flexDirection:'row',justifyContent:'space-between'}}><Text style={styles.headerTitle}>🏚️ APP BASEMENT</Text><TouchableOpacity onPress={()=>setBasementVisible(false)}><Text style={{color:'#fff'}}>Close</Text></TouchableOpacity></View>
          <ScrollView><Text style={styles.sectionLabel}>Task</Text><View style={styles.card}><Text style={{color:'#888',fontFamily:'monospace'}}>{JSON.stringify(taskStatus||{status:'idle'},null,2)}</Text></View></ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:{flex:1,backgroundColor:'#0A0A0A'}, headerTitle:{color:'#fff',fontSize:22,fontWeight:'800',marginBottom:12},
  sectionLabel:{color:'#888',fontSize:11,fontWeight:'700',marginTop:16,marginBottom:6,letterSpacing:1},
  card:{backgroundColor:'#1A1A1A',borderRadius:16,padding:14,marginBottom:4},
  cardHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  cardTitle:{color:'#fff',fontWeight:'700',fontSize:16},
  activeBadge:{backgroundColor:'#052e16',paddingHorizontal:10,paddingVertical:4,borderRadius:12,borderWidth:1,borderColor:'#16a34a'},
  activeText:{color:'#22c55e',fontSize:11,fontWeight:'700'},
  githubRow:{flexDirection:'row',alignItems:'center',marginTop:12},
  avatar:{width:44,height:44,borderRadius:22,backgroundColor:'#333'},
  username:{color:'#fff',fontWeight:'700'}, subText:{color:'#888',fontSize:12},
  connectBtn:{backgroundColor:'#fff',padding:14,borderRadius:12,alignItems:'center',marginTop:12},
  connectText:{color:'#000',fontWeight:'800'},
  disconnectBtn:{borderWidth:1,borderColor:'#333',padding:8,borderRadius:8,marginLeft:8},
  redText:{color:'#ef4444',fontSize:12,fontWeight:'700'},
  toggleRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingVertical:10,borderBottomWidth:0.5,borderColor:'#222'},
  subRow:{marginLeft:16,backgroundColor:'#222',borderRadius:8,paddingHorizontal:12,marginVertical:2},
  toggleLabel:{color:'#fff',fontWeight:'600'}, subLabel:{fontSize:13,color:'#ccc'},
  working:{color:'#f97316',fontSize:11,fontWeight:'700',marginTop:4},
  basementBtn:{backgroundColor:'#333',padding:10,borderRadius:8,alignItems:'center',marginTop:12},
  modalBg:{flex:1,backgroundColor:'rgba(0,0,0,0.85)',justifyContent:'center',padding:20},
  modalCard:{backgroundColor:'#1A1A1A',borderRadius:16,padding:20},
  modalTitle:{color:'#fff',fontWeight:'800',fontSize:16},
  modalSub:{color:'#888',fontSize:11,marginTop:6,lineHeight:14},
  input:{backgroundColor:'#0A0A0A',borderWidth:1,borderColor:'#333',borderRadius:10,padding:14,color:'#fff',marginTop:12},
  footer:{color:'#555',textAlign:'center',marginVertical:20,fontSize:11}
});