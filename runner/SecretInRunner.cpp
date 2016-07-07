// SecretInRunner.cpp : définit le point d'entrée pour l'application console.
//

#include "stdafx.h"
#include <Windows.h>
#include <wtsapi32.h>
#include <TlHelp32.h>
#include <Strsafe.h>
#include <atlbase.h>
#include <objbase.h>
#include <comutil.h>
#include <WbemIdl.h>

#define SVCNAME L"Secret-in.me"

//DWORD Sessions = 0;
HANDLE ghSvcStopEvent = NULL;
BOOL shouldStop = FALSE;

void SvcReportEvent(LPTSTR szFunction) {
	/*
	HKEY hkResult;
	RegCreateKey(HKEY_LOCAL_MACHINE, L"SYSTEM\\CurrentControlSet\\services\\eventlog\\Application\\Secret-in.me", &hkResult);

	DWORD CategoryCount = 1;
	LPWSTR CategoryMessageFile[] = L""
	RegSetKeyValue(hkResult, NULL, L"CategoryCount", REG_DWORD, &CategoryCount, sizeof(CategoryCount));
	
	RegSetKeyValue(hkResult, NULL, L"CategoryMessageFile", 0, REG_SZ);
	RegSetKeyValue(hkResult, NULL, L"EventMessageFile", 0, REG_SZ);
	RegSetKeyValue(hkResult, NULL, L"ParameterMessageFile", 0, REG_SZ);
	RegSetKeyValue(hkResult, NULL, L"TypesSupported", REG_DWORD, EVENTLOG_AUDIT_FAILURE | EVENTLOG_AUDIT_SUCCESS);
	*/
	HANDLE hEventSource;
	LPCTSTR lpszStrings[2];
	TCHAR Buffer[80];
	hEventSource = RegisterEventSource(NULL, SVCNAME);
	if (NULL != hEventSource) {
		StringCchPrintf(Buffer, 80, L"%s failed with %d", szFunction, GetLastError());

		lpszStrings[0] = SVCNAME;
		lpszStrings[1] = Buffer;

		ReportEvent(hEventSource,
			EVENTLOG_ERROR_TYPE,
			0,
			0xC0020001L,
			NULL,
			2,
			0,
			lpszStrings,
			NULL);
	}
	DeregisterEventSource(hEventSource);
}

bool terminateSecretin(DWORD oldSessionId) {
	HANDLE hToken = NULL;
	DWORD sessionId = 0;
	DWORD length;
	HANDLE hProcessSnap;
	HANDLE hProcess;
	PROCESSENTRY32 pe;
	hProcessSnap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, NULL);
	if (hProcessSnap == INVALID_HANDLE_VALUE) {
		SvcReportEvent(L"Terminate_CreateToolhelp32Snapshot");
		return FALSE;
	}
	pe.dwSize = sizeof(PROCESSENTRY32);
	if (!Process32First(hProcessSnap, &pe)) {
		SvcReportEvent(L"Terminate_Process32First");
		return FALSE;
	}

	do {
		if (wcsncmp(pe.szExeFile, L"secret-in.me.exe", 16) == NULL) {
			hProcess = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_TERMINATE, FALSE, pe.th32ProcessID);
			if (hProcess == 0) {
				SvcReportEvent(L"Terminate_OpenProcess");
				continue;
			}

			if (!OpenProcessToken(hProcess, TOKEN_ALL_ACCESS, &hToken)) {
				SvcReportEvent(L"Terminate_OpenProcessToken");
				CloseHandle(hProcess);
				continue;
			}
			GetTokenInformation(hToken, TokenSessionId, &sessionId, sizeof(sessionId), &length);
			CloseHandle(hToken);
			if (oldSessionId == sessionId) {
				TerminateProcess(hProcess, 0);
			}
			CloseHandle(hProcess);
		}
	} while (Process32Next(hProcessSnap, &pe));
	return TRUE;
}

bool runSecretin(DWORD newSessionId) {
	HANDLE hToken = NULL;
	HANDLE hDupToken;
	HANDLE hProcessSnap;
	HANDLE hProcess;
	DWORD sessionId = 0;
	DWORD length;
	PROCESSENTRY32 pe;
	bool found = FALSE;

	hProcessSnap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, NULL);
	if (hProcessSnap == INVALID_HANDLE_VALUE) {
		SvcReportEvent(L"CreateToolhelp32Snapshot");
		return FALSE;
	}
	pe.dwSize = sizeof(PROCESSENTRY32);
	if (!Process32First(hProcessSnap, &pe)) {
		SvcReportEvent(L"Process32First");
		return FALSE;
	}
	do {
		if (wcsncmp(pe.szExeFile, L"winlogon.exe", 12) == NULL) {
			hProcess = OpenProcess(PROCESS_QUERY_INFORMATION, FALSE, pe.th32ProcessID);
			if (hProcess == 0) {
				SvcReportEvent(L"OpenProcess");
				continue;
			}

			if (!OpenProcessToken(hProcess, TOKEN_ALL_ACCESS, &hToken)) {
				SvcReportEvent(L"OpenProcessToken");
				CloseHandle(hProcess);
				continue;
			}
			GetTokenInformation(hToken, TokenSessionId, &sessionId, sizeof(sessionId), &length);
			CloseHandle(hProcess);
			/*
			if ((Sessions&(2 << (sessionId - 1))) != 0) {
			SvcReportEvent(L"Already exists");
			continue;
			}
			*/
			if (newSessionId != -1 && newSessionId != sessionId) {
				CloseHandle(hToken);
				continue;
			}
			
			found = TRUE;
			break;
		}
	} while (Process32Next(hProcessSnap, &pe));
	CloseHandle(hProcessSnap);

	if (hToken == NULL) {
		SvcReportEvent(L"hToken");
		return FALSE;
	}

	if (!found) {
		CloseHandle(hToken);
		SvcReportEvent(L"FindWinlogon");
		return FALSE;
	}

	if (!DuplicateTokenEx(hToken, TOKEN_ALL_ACCESS, NULL, SecurityImpersonation, TokenPrimary, &hDupToken)) {
		CloseHandle(hToken);
		SvcReportEvent(L"DuplicateTokenEx");
		return FALSE;
	}

	STARTUPINFO si;
	PROCESS_INFORMATION pi;
	memset(&pi, 0, sizeof(PROCESS_INFORMATION));
	memset(&si, 0, sizeof(STARTUPINFO));
	si.cb = sizeof(STARTUPINFO);
	si.dwFlags = STARTF_USESHOWWINDOW;
	si.wShowWindow = SW_MINIMIZE;
	si.lpDesktop = L"WinSta0\\WinLogon";
	if (!CreateProcessAsUser(hDupToken, L"C:\\secret-in.me-win32-x64\\secret-in.me.exe", L"preLogon preLogon preLogon", NULL, NULL, FALSE, 0, NULL, L"C:\\secret-in.me-win32-x64\\", &si, &pi)) {
		CloseHandle(hDupToken);
		CloseHandle(hToken);
		SvcReportEvent(L"CreateProcessAsUser");
		return FALSE;
	}
	CloseHandle(hDupToken);
	CloseHandle(hToken);
	//Sessions |= (2 << (sessionId-1));
	return TRUE;
}

DWORD WINAPI SvcCtrlHandler(DWORD dwControl, DWORD dwEventType, LPVOID lpEventData, LPVOID lpContext) {
	WTSSESSION_NOTIFICATION *sessionNotification;
	switch (dwControl) {
		case SERVICE_CONTROL_STOP:
			shouldStop = TRUE;
			SetEvent(ghSvcStopEvent);
			break;
		case SERVICE_CONTROL_SESSIONCHANGE:
			sessionNotification = (WTSSESSION_NOTIFICATION*)lpEventData;
			terminateSecretin(sessionNotification->dwSessionId);
			/*
			switch (dwEventType) {
				case WTS_CONSOLE_CONNECT:
				case WTS_SESSION_LOCK:
					wchar_t reportEvent[255];
					_snwprintf_s(reportEvent, 255, L"SESSIONCHANGE %d", sessionNotification->dwSessionId);
					SvcReportEvent(reportEvent);
					runSecretin(sessionNotification->dwSessionId);
					break;
				default:
					break;
			}
			*/
			break;
		case SERVICE_CONTROL_INTERROGATE:
			break;
		default:
			break;
	}
	return 0;
}

DWORD WINAPI monitorLogonUi(LPVOID lpParameter) {
	HRESULT hr = CoInitializeEx(NULL, COINIT_MULTITHREADED);
	if (FAILED(hr)) {
		SvcReportEvent(L"CoInitializeEx");
		return FALSE;
	}

	hr = CoInitializeSecurity(NULL, -1, NULL, NULL, RPC_C_AUTHN_LEVEL_DEFAULT, RPC_C_IMP_LEVEL_IMPERSONATE, NULL, EOAC_NONE, NULL);
	if (FAILED(hr)) {
		SvcReportEvent(L"CoInitializeSecurity");
		return FALSE;
	}

	int result = 0;
	{
		CComPtr<IWbemLocator> locator;
		hr = CoCreateInstance(CLSID_WbemAdministrativeLocator, NULL, CLSCTX_INPROC_SERVER, IID_IWbemLocator, reinterpret_cast<void**>(&locator));
		if (FAILED(hr)) {
			SvcReportEvent(L"CoCreateInstance");
			return FALSE;
		}
		CComPtr<IWbemServices> service;
		hr = locator->ConnectServer(L"root\\cimv2", NULL, NULL, NULL, WBEM_FLAG_CONNECT_USE_MAX_WAIT, NULL, NULL, &service);
		if (SUCCEEDED(hr)) {
			CComPtr<IEnumWbemClassObject> enumerator;
			hr = service->ExecNotificationQuery(L"WQL", L"SELECT * FROM __InstanceCreationEvent WITHIN 1 WHERE TargetInstance ISA 'Win32_Process' and TargetInstance.Name = 'LogonUI.exe'", WBEM_FLAG_FORWARD_ONLY | WBEM_FLAG_RETURN_IMMEDIATELY, NULL, &enumerator);
			if (SUCCEEDED(hr)) {
				do {
					CComPtr<IWbemClassObject> folder = NULL;
					ULONG retcnt = 0L;
					while ((hr = enumerator->Next(WBEM_INFINITE, 1L, &folder, &retcnt)) == WBEM_S_TIMEDOUT);
					if (SUCCEEDED(hr)) {
						if (retcnt > 0) {
							_variant_t var_val;
							hr = folder->Get(L"TargetInstance", 0, &var_val, NULL, NULL);
							if (SUCCEEDED(hr)) {
								IUnknown* str = var_val;
								CComPtr<IWbemClassObject> obj;
								hr = str->QueryInterface(IID_IWbemClassObject, reinterpret_cast<void**>(&obj));
								if (SUCCEEDED(hr)) {
									_variant_t sid;
									hr = obj->Get(L"SessionId", 0, &sid, NULL, NULL);
									if (SUCCEEDED(hr)) {
										int sessionId = sid;
										terminateSecretin(sessionId);
										runSecretin(sessionId);
									}
									else {
										SvcReportEvent(L"LastGet");
									}
								}
								else {
									SvcReportEvent(L"QueryInterface");
								}
							}
							else {
								SvcReportEvent(L"Get");
							}
						}
						else {
							SvcReportEvent(L"retcnt");
						}
					}
					else {
						SvcReportEvent(L"Next");
					}
				} while (!shouldStop);
			}
			else {
				SvcReportEvent(L"ExecNotificationQuery");
			}
		}
		else {
			SvcReportEvent(L"ConnectServer");
		}
	}
	CoUninitialize();
	return TRUE;
}

void WINAPI SvcMain(DWORD dwArgc, LPTSTR* lpszArgv) {
	HANDLE wmiThread;
	SERVICE_STATUS gSvcStatus;
	SERVICE_STATUS_HANDLE gSvcStatusHandle = RegisterServiceCtrlHandlerEx(SVCNAME, SvcCtrlHandler, NULL);
	if (!gSvcStatusHandle) {
		SvcReportEvent(L"RegisterServiceCtrlHandler");
		return;
	}
	wmiThread = CreateThread(NULL, NULL, monitorLogonUi, NULL, NULL, NULL);

	ghSvcStopEvent = CreateEvent(NULL, TRUE, FALSE, NULL);
	if (ghSvcStopEvent == NULL) {
		SvcReportEvent(L"CreateEvent");
		return;
	}

	gSvcStatus.dwServiceType = SERVICE_WIN32_OWN_PROCESS|SERVICE_INTERACTIVE_PROCESS;
	gSvcStatus.dwCurrentState = SERVICE_RUNNING;
	gSvcStatus.dwControlsAccepted = SERVICE_ACCEPT_STOP | SERVICE_ACCEPT_SESSIONCHANGE;
	gSvcStatus.dwWin32ExitCode = NO_ERROR;
	gSvcStatus.dwServiceSpecificExitCode = NULL;
	gSvcStatus.dwCheckPoint = NULL;
	gSvcStatus.dwWaitHint = NULL;

	SetServiceStatus(gSvcStatusHandle, &gSvcStatus);

	runSecretin(-1);

	while (1) {
		WaitForSingleObject(ghSvcStopEvent, INFINITE);
		gSvcStatus.dwCurrentState = SERVICE_STOPPED;
		SetServiceStatus(gSvcStatusHandle, &gSvcStatus);
		return;
	}
}

int __stdcall WinMain(HINSTANCE hInst, HINSTANCE hPrevInst, char *szCmdLine, int iCmdShow)
{
	SERVICE_TABLE_ENTRY DispatchTable[] =
	{
		{SVCNAME, (LPSERVICE_MAIN_FUNCTION) SvcMain},
		{NULL, NULL}
	};
	if (!StartServiceCtrlDispatcher(DispatchTable)) {
		SvcReportEvent(L"StartServiceCtrlDispatcher");
	}

	return 0;
}
