import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function TabsLayout() {
	const { t } = useTranslation();

	return (
		<Tabs
			screenOptions={{
				headerStyle: { backgroundColor: '#0b0b12' },
				headerTintColor: '#f2f2f7',
				headerShadowVisible: false,
				headerShown: false,
				tabBarStyle: {
					backgroundColor: '#15151f',
					borderTopColor: '#2a2a3a',
				},
				tabBarActiveTintColor: '#7c5cff',
				tabBarInactiveTintColor: '#9a9ab0',
			}}
		>
			<Tabs.Screen
				name='index'
				options={{
					title: t('tabs.home'),
					tabBarIcon: ({ color, size }) => (
						<Ionicons name='home' size={size} color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name='upcoming'
				options={{
					title: t('tabs.upcoming'),
					tabBarIcon: ({ color, size }) => (
						<Ionicons name='calendar' size={size} color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name='search'
				options={{
					title: t('tabs.search'),
					tabBarIcon: ({ color, size }) => (
						<Ionicons name='search' size={size} color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name='library'
				options={{
					title: t('tabs.library'),
					tabBarIcon: ({ color, size }) => (
						<Ionicons name='albums' size={size} color={color} />
					),
				}}
			/>

			<Tabs.Screen
				name='profile'
				options={{
					title: t('tabs.you'),
					tabBarIcon: ({ color, size }) => (
						<Ionicons name='person' size={size} color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name='settings'
				options={{
					href: null,
				}}
			/>
		</Tabs>
	);
}
