// 참조 데이터 설정 저장 함수는 이제 savePrompt 함수에 통합되었습니다.

// 전역 변수 (파일 최상단에 추가)
let filesToUpload = [];
let fileList;
let startUploadBtn;
let chatSessionsData = []; // 채팅 세션 데이터 전역 변수
let currentUserInfo = null;
let settingsLoaded = false;
let docsLoaded = false;
let chatLogsCache = {}; // 채팅 로그 캐시 (uuid -> logs)
let lastSortedSessions = []; // 최근 정렬 결과 저장
let chatSessionsLoaded = false; // 세션이 이미 로드되었는지 여부
let chatSessionsLoading = false; // 세션 로딩 중인지 여부

// 참조 데이터 설정 로드 함수
function loadReferenceSettings() {
  try {
    // Load settings from localStorage (or from API in a real application)
    const referencesEnabled = localStorage.getItem('referencesEnabled') !== 'false'; // Default to true
    const downloadButtonEnabled = localStorage.getItem('downloadButtonEnabled') !== 'false'; // Default to true

    // Set toggle values
    document.getElementById('toggle-references').checked = referencesEnabled;
    document.getElementById('toggle-download-button').checked = downloadButtonEnabled;
  } catch (error) {
    console.error('설정 로드 중 오류 발생:', error);
  }
}

// 알림 함수(파일 최상단에 위치)
function showNotification(message, type = 'info') {
  let toast = document.getElementById('toast-notification');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast-notification';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = 'toast' + (type === 'success' ? ' success' : type === 'error' ? ' error' : '');
  toast.style.display = 'block';
  toast.style.opacity = '1';
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => {
      toast.style.display = 'none';
    }, 400);
  }, 2100);
}

// 사이드바 토글 설정
// Prompt Form Functions
function setupPromptForm() {
    // 더 이상 동적으로 prompt-container를 생성하지 않음 (중앙 폼에 직접 추가됨)
    // 중앙 폼의 저장 버튼에 이벤트 연결만 수행
    // 상단 저장 버튼 클릭 시 폼 입력값을 백엔드로 전송
    
    // form submit 기본동작 방지
    const promptForm = document.getElementById('prompt-settings-form');
    if (promptForm) {
      promptForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        try {
          await savePrompt();
          showNotification('설정이 성공적으로 저장되었습니다!', 'success');
        } catch (error) {
          console.error('저장 중 오류 발생:', error);
          showNotification(error.message || '저장 중 오류가 발생했습니다.', 'error');
        }
      });
    }
}

// Save button state management
function setSaveButtonLoading(button, isLoading) {
    if (!button) return;
    
    // Find the button text and loading elements
    const buttonText = button.querySelector('.button-text');
    const buttonLoading = button.querySelector('.button-loading');
    
    if (isLoading) {
        button.classList.add('loading');
        button.disabled = true;
        
        // Show loading state if elements exist
        if (buttonText) buttonText.style.display = 'none';
        if (buttonLoading) buttonLoading.style.display = 'inline-flex';
    } else {
        button.classList.remove('loading');
        button.disabled = false;
        
        // Show normal state
        if (buttonText) buttonText.style.display = 'inline';
        if (buttonLoading) buttonLoading.style.display = 'none';
    }
}

// Show save message
function showSaveMessage(message, type = 'success') {
    const messageElement = document.getElementById('save-message');
    if (!messageElement) return;
    
    // Set message content and type
    messageElement.textContent = message;
    messageElement.className = 'save-message';
    messageElement.classList.add(type, 'show');
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
        messageElement.classList.remove('show');
    }, 3000);
}

async function savePrompt(event) {
    // Prevent form submission if called from a form
    if (event) {
        event.preventDefault();
    }
    
    // Get the button that was clicked (if any)
    const saveButton = event && event.submitter 
        ? event.submitter 
        : document.getElementById('save-prompt-btn');
    
    // Set loading state
    if (saveButton) {
        setSaveButtonLoading(saveButton, true);
    }
    
    // Clear any existing messages after a short delay to allow loading message to show
    setTimeout(() => {
        const messageElement = document.getElementById('save-message');
        if (messageElement) {
            messageElement.className = 'save-message';
        }
    }, 50);
    
    // Get prompt data
    const aiGreeting = document.getElementById('ai-greeting')?.value.trim() || '';
    const trainingData = document.getElementById('training-data')?.value.trim() || '';
    const instructionData = document.getElementById('instruction-data')?.value.trim() || '';

    // Get GPT settings
    const model = document.getElementById('gpt-model')?.value || 'gpt-4o-mini';
    const temperature = parseFloat(document.getElementById('temperature')?.value) || 0.7;
    const maxTokens = parseInt(document.getElementById('max-tokens')?.value) || 2048;
    
    // Get toggle values
    const referencesEnabled = document.getElementById('toggle-references')?.checked ?? true;
    const downloadButtonEnabled = document.getElementById('toggle-download-button')?.checked ?? true;

    try {
        // Validate required fields
        if (!trainingData) {
            throw new Error('학습데이터는 필수 항목입니다.');
        }
        
        // Combine all data into a single payload
        const payload = {
            // Prompt data
            ai_greeting: aiGreeting,
            training_data: trainingData,
            instruction_data: instructionData,
            
            // GPT settings
            gpt_settings: {
                model: model,
                temperature: temperature,
                max_tokens: maxTokens
            },
            
            // Reference data settings
            reference_settings: {
                references_enabled: referencesEnabled,
                download_button_enabled: downloadButtonEnabled
            }
        };

        // Show loading message
        showSaveMessage('저장 중입니다...', 'info');
        
        // Save to backend → Google Sheets
        const response = await fetch('/api/save-settings', {
            method: 'POST',
            headers: { ...authHeaders(), 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || '서버 응답이 올바르지 않습니다.');
        }

        // Show success message
        showSaveMessage('설정이 성공적으로 저장되었습니다!', 'success');
        
    } catch (error) {
        console.error('Error saving settings:', error);
        showSaveMessage(error.message || '저장 중 오류가 발생했습니다.', 'error');
    } finally {
        // Reset button states for both save buttons
        const saveButtons = [
            document.getElementById('save-prompt-btn'),
            document.querySelector('#gpt-settings-form button[type="submit"]')
        ];
        
        saveButtons.forEach(button => {
            if (button) {
                setSaveButtonLoading(button, false);
            }
        });
    }
}

// 문서 목록을 가져오는 함수
async function loadDocumentList() {
  const documentList = document.getElementById('document-list');
  if (!documentList) return;

  try {
    documentList.innerHTML = `
      <tr>
        <td colspan="3" class="px-6 py-4 text-center text-sm text-gray-500">
          <div class="flex justify-center items-center">
            <span class="loading-text" style="font-size:1.2em; margin-right:0.5em;">⏳</span>
            문서 목록을 불러오는 중...
          </div>
        </td>
      </tr>
    `;

    const response = await fetch('/api/documents', { headers: authHeaders(), credentials: 'same-origin' });
    if (!response.ok) {
      throw new Error('문서 목록을 불러오는데 실패했습니다.');
    }

    const documents = await response.json();
    
    if (documents.length === 0) {
      documentList.innerHTML = `
        <tr>
          <td colspan="3" class="px-6 py-4 text-center text-sm text-gray-500">
            업로드된 문서가 없습니다.
          </td>
        </tr>
      `;
      return;
    }

    // 문서 목록을 표 형식으로 렌더링
    documentList.innerHTML = documents.map(doc => `
      <tr class="hover:bg-gray-50">
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
          <div class="flex items-center">
            <span class="doc-icon" style="font-size:1.1em; color:#bbb;">📄</span>
            <span class="ml-2">${doc.name}</span>
          </div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
            업로드 완료
          </span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          ${new Date().toLocaleString()}
          <button class="delete-doc-btn" data-doc-name="${encodeURIComponent(doc.name)}" style="margin-left:1em; color:#e35; background:none; border:none; cursor:pointer; font-size:0.95em;">삭제</button>
        </td>
      </tr>
    `).join('');

    // 삭제 버튼 이벤트 리스너 등록
    // 에러 메시지 표시 함수
    function showDocError(msg) {
      let msgBox = document.getElementById('doc-error-msg');
      if (!msgBox) {
        msgBox = document.createElement('div');
        msgBox.id = 'doc-error-msg';
        msgBox.style.background = '#4b1c1c';
        msgBox.style.color = '#fff';
        msgBox.style.padding = '8px 16px';
        msgBox.style.marginBottom = '8px';
        msgBox.style.borderRadius = '6px';
        msgBox.style.fontSize = '0.96em';
        msgBox.style.textAlign = 'center';
        msgBox.style.maxWidth = '600px';
        msgBox.style.margin = '0 auto 8px auto';
        const table = document.querySelector('.custom-table');
        if (table && table.parentNode) table.parentNode.insertBefore(msgBox, table);
      }
      msgBox.textContent = msg;
      msgBox.style.display = 'block';
      setTimeout(() => { msgBox.style.display = 'none'; }, 2200);
    }

    document.querySelectorAll('.delete-doc-btn').forEach(btn => {
      btn.addEventListener('click', async function(e) {
        const docName = decodeURIComponent(this.dataset.docName);
        const row = this.closest('tr');
        if (row) {
          row.style.transition = 'opacity 0.5s';
          row.style.opacity = '0.5';
          this.disabled = true;
        }
        try {
          const res = await fetch(`/api/documents/${encodeURIComponent(docName)}`, { method: 'DELETE', headers: authHeaders(), credentials: 'same-origin' });
          if (res.ok) {
            if (row) {
              row.style.opacity = '0';
              setTimeout(() => { row.remove(); }, 500);
            }
          } else {
            const err = await res.json();
            if (row) {
              row.style.opacity = '1';
              this.disabled = false;
            }
            showDocError('삭제 실패: ' + (err.detail || '알 수 없는 오류'));
          }
        } catch (err) {
          if (row) {
            row.style.opacity = '1';
            this.disabled = false;
          }
          showDocError('삭제 중 오류 발생: ' + err.message);
        }
      });
    });

  } catch (error) {
    console.error('문서 목록 로드 오류:', error);
    documentList.innerHTML = `
      <tr>
        <td colspan="3" class="px-6 py-4 text-center text-sm text-red-500">
          문서 목록을 불러오는 중 오류가 발생했습니다: ${error.message}
          <button onclick="loadDocumentList()" class="ml-2 text-blue-500 hover:text-blue-700">
            다시 시도
          </button>
        </td>
      </tr>
    `;
  }
}

  // Initialize reference data settings when DOM is loaded
  document.addEventListener('DOMContentLoaded', function () {
    // 초기 상태: 로그인하지 않은 상태로 UI 숨김
    hideLoggedInUI();
    
    // Initialize reference data settings
    loadReferenceSettings();
    
    // Initialize file upload functionality
    initializeFileUpload();
    
    // 로그인 체크 → 이후 초기화(무거운 데이터는 탭 진입 시 로드)
    initAuthAndGuard();
    
    
    
    // 프롬프트 설정 저장 버튼 초기화
    setupPromptSaveButton();
  
  // 새로고침 버튼 이벤트 리스너 추가
  const refreshBtn = document.getElementById('refresh-docs-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadDocumentList);
  }
  
  // Add event listeners for toggle switches to save automatically when toggled
  const toggleReferences = document.getElementById('toggle-references');
  const toggleDownloadButton = document.getElementById('toggle-download-button');
  
  function handleToggleChange() {
    // Save to localStorage immediately for better UX
    const referencesEnabled = document.getElementById('toggle-references').checked;
    const downloadButtonEnabled = document.getElementById('toggle-download-button').checked;
    
    localStorage.setItem('referencesEnabled', referencesEnabled);
    localStorage.setItem('downloadButtonEnabled', downloadButtonEnabled);
    
    // Trigger save
    savePrompt();
  }
  
  if (toggleReferences) {
    toggleReferences.addEventListener('change', handleToggleChange);
  }
  
  if (toggleDownloadButton) {
    toggleDownloadButton.addEventListener('change', handleToggleChange);
  }
  // Chatbot Connection Elements
  const chatbotUrlInput = document.getElementById('chatbot-url');
  const checkStatusBtn = document.getElementById('check-status-btn');
  const saveChatbotUrlBtn = document.getElementById('save-chatbot-url');
  const copyIframeBtn = document.getElementById('copy-iframe-code');
  const connectionStatus = document.getElementById('connection-status');
  const lastChecked = document.getElementById('last-checked');
  const previewStatus = document.getElementById('preview-status');
  const chatbotIframe = document.getElementById('chatbot-iframe');
  const noPreview = document.getElementById('no-preview');
  const iframeModal = document.getElementById('iframe-modal');
  const closeModalBtn = document.querySelector('.close-modal');
  const copyCodeBtn = document.getElementById('copy-code');
  const iframeCode = document.getElementById('iframe-code');
  
  // Load saved chatbot URL if exists
  const savedChatbotUrl = localStorage.getItem('chatbotUrl');
  if (savedChatbotUrl) {
    chatbotUrlInput.value = savedChatbotUrl;
    updateIframePreview(savedChatbotUrl);
    checkChatbotStatus(savedChatbotUrl);
  }
  
  // Event Listeners
  if (checkStatusBtn) {
    checkStatusBtn.addEventListener('click', () => {
      const url = chatbotUrlInput.value.trim();
      if (url) {
        checkChatbotStatus(url);
      } else {
        showNotification('챗봇 URL을 입력해주세요.', 'error');
      }
    });
  }
  
  if (saveChatbotUrlBtn) {
    saveChatbotUrlBtn.addEventListener('click', () => {
      const url = chatbotUrlInput.value.trim();
      if (url) {
        localStorage.setItem('chatbotUrl', url);
        updateIframePreview(url);
        checkChatbotStatus(url);
        showNotification('챗봇 URL이 저장되었습니다.', 'success');
      } else {
        showNotification('유효한 URL을 입력해주세요.', 'error');
      }
    });
  }
  
  if (copyIframeBtn) {
    copyIframeBtn.addEventListener('click', () => {
      const url = chatbotUrlInput.value.trim();
      if (url) {
        showIframeCodeModal(url);
      } else {
        showNotification('먼저 챗봇 URL을 저장해주세요.', 'error');
      }
    });
  }
  
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
      iframeModal.classList.remove('show');
    });
  }
  
  if (copyCodeBtn) {
    copyCodeBtn.addEventListener('click', copyIframeCodeToClipboard);
  }
  
  // Close modal when clicking outside
  window.addEventListener('click', (e) => {
    if (e.target === iframeModal) {
      iframeModal.classList.remove('show');
    }
  });

  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const sidebar = document.getElementById('sidebar');

  if (!hamburgerBtn || !sidebar) {
    console.error('햄버거 버튼 또는 사이드바를 찾을 수 없습니다.');
    return;
  }

  function toggleSidebar() {
    const isCollapsed = sidebar.classList.toggle('collapsed');
    const icon = hamburgerBtn.querySelector('svg');
    if (isCollapsed) {
      icon.innerHTML = '<path d="M3 12H21M3 6H21M3 18H21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
      document.body.classList.remove('sidebar-open');
    } else {
      icon.innerHTML = '<path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
      document.body.classList.add('sidebar-open');
    }
  }

  hamburgerBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    toggleSidebar();
  });

  document.addEventListener('click', function (e) {
    const isMobile = window.innerWidth <= 768;
    const isSidebarOpen = !sidebar.classList.contains('collapsed');
    const isClickInsideSidebar = e.target.closest('.sidebar');
    const isClickOnHamburger = e.target === hamburgerBtn;

    if (isMobile && isSidebarOpen && !isClickInsideSidebar && !isClickOnHamburger) {
      toggleSidebar();
    }
  });

  const isMobileView = window.innerWidth <= 768;
  if (isMobileView) {
    sidebar.classList.add('collapsed');
  }

  // 탭 전환 기능 초기화
  function switchTab(tabId) {
    console.log('Switching to tab:', tabId);
    
    // 모든 탭 컨텐츠 숨기기
    document.querySelectorAll('.content-section').forEach(section => {
      section.classList.remove('active');
    });
    
    // 모든 버튼 비활성화
    document.querySelectorAll('.action-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    
    // 선택한 탭 컨텐츠 표시
    let activeSection;
    if (tabId === 'admin-management') {
      activeSection = document.getElementById('admin-management-content');
      console.log('Looking for admin-management-content:', activeSection);
    } else {
      activeSection = document.getElementById(tabId + '-content') || document.getElementById(tabId);
      console.log('Looking for', tabId + '-content or #' + tabId + ':', activeSection);
    }
    
    if (activeSection) {
      activeSection.classList.add('active');
      console.log('Successfully activated section:', activeSection.id);
    } else {
      console.error('Section not found for tab:', tabId);
      // 디버깅을 위해 모든 content-section 출력
      const allSections = document.querySelectorAll('.content-section');
      console.log('Available sections:', Array.from(allSections).map(s => s.id));
    }
    
    // 선택한 버튼 활성화 (탭 ID → 버튼 ID 매핑)
    const buttonIdMap = {
      'chatbot-connect': 'chatbotconnect',
      'chat-history': 'chatHistory',
      'gpt-setting': 'gptsetting',
      'prompt-setting': 'promptsetting',
      'data-setting': 'datasetting',
      'reference-data': 'referencedatasetting',
      'admin-management': 'adminmanage'
    };
    const btnId = buttonIdMap[tabId] || tabId;
    const activeButton = document.getElementById(btnId);
    if (activeButton) {
      activeButton.classList.add('active');
      console.log('Activated button:', btnId);
    } else {
      console.error('Button not found for tab:', tabId);
    }

    // 챗봇 연결 탭이 활성화되면 자동으로 상태 확인
    if (tabId === 'chatbot-connect') {
      const chatbotUrlInput = document.getElementById('chatbot-url');
      if (chatbotUrlInput && chatbotUrlInput.value) {
        checkChatbotStatus(chatbotUrlInput.value);
      }
    }
  }
  
  // 사이드바 버튼에 이벤트 리스너 추가
  document.getElementById('chatbotconnect').addEventListener('click', () => {
    switchTab('chatbot-connect');
    if (window.innerWidth <= 768) {
      toggleSidebar();
    }
  });

  // 채팅 기록 버튼에 이벤트 리스너 추가
  document.getElementById('chatHistory').addEventListener('click', () => {
    switchTab('chat-history');
    if (window.innerWidth <= 768) {
      toggleSidebar();
    }
    // 채팅 기록 불러오기 (이미 로드된 경우 재요청하지 않음)
    if (!chatSessionsLoaded && !chatSessionsLoading) {
      loadChatSessions();
    } else {
      // 이미 데이터가 있으면 리스트만 다시 표시
      setupSortOptions();
      displaySortedSessions('default');
    }
  });
  
  document.getElementById('gptsetting').addEventListener('click', () => {
    switchTab('gpt-setting');
    if (!settingsLoaded) { settingsLoaded = true; loadAllSettings(); }
    if (window.innerWidth <= 768) {
      toggleSidebar();
    }
  });
  
  document.getElementById('promptsetting').addEventListener('click', () => {
    switchTab('prompt-setting');
    if (!settingsLoaded) { settingsLoaded = true; loadAllSettings(); }
    if (window.innerWidth <= 768) {
      toggleSidebar();
    }
  });
  
  document.getElementById('datasetting').addEventListener('click', () => {
    switchTab('data-setting');
    if (!docsLoaded) { docsLoaded = true; loadDocumentList(); }
    if (window.innerWidth <= 768) {
      toggleSidebar();
    }
  });
  
  document.getElementById('referencedatasetting').addEventListener('click', () => {
    switchTab('reference-data');
    if (!settingsLoaded) { settingsLoaded = true; loadAllSettings(); }
    if (window.innerWidth <= 768) {
      toggleSidebar();
    }
  });

  // 관리자 관리 버튼 이벤트 (전역에서 1회 바인딩)
  const adminManageBtn = document.getElementById('adminmanage');
  if (adminManageBtn) {
    adminManageBtn.addEventListener('click', () => {
      console.log('Admin management button clicked');
      switchTab('admin-management');
      // 탭 전환 후 패널 렌더
      setTimeout(() => {
        const adminSection = document.getElementById('admin-management-content');
        if (adminSection && adminSection.classList.contains('active')) {
          renderAdminPanel();
        } else {
          // 강제 활성화 및 렌더
          document.querySelectorAll('.content-section').forEach(section => section.classList.remove('active'));
          adminSection?.classList.add('active');
          document.querySelectorAll('.action-btn').forEach(btn => btn.classList.remove('active'));
          adminManageBtn.classList.add('active');
          renderAdminPanel();
        }
      }, 0);
      if (window.innerWidth <= 768) {
        toggleSidebar();
      }
    });
  }
  
  // 기본으로 챗봇 연결 탭 표시
  switchTab('chatbot-connect');
  
  // API 키 표시/숨기기 토글
  const apiKeyInput = document.getElementById('openai-api-key');
  const toggleApiKeyBtn = document.getElementById('toggle-api-key');
  
  if (toggleApiKeyBtn && apiKeyInput) {
    toggleApiKeyBtn.addEventListener('click', () => {
      const type = apiKeyInput.type === 'password' ? 'text' : 'password';
      apiKeyInput.type = type;
      
      // 아이콘 업데이트
      const icon = toggleApiKeyBtn.querySelector('svg');
      if (type === 'text') {
        icon.innerHTML = '<path d="M3 12C3 12 7 4 12 4C19 4 23 12 23 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 12C3 12 7 20 12 20C19 20 23 12 23 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15V15C13.6569 15 15 13.6569 15 12Z" fill="currentColor"/>';
      } else {
        icon.innerHTML = '<path d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M1 12C1 12 5 20 12 20C19 20 23 12 23 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" fill="currentColor"/>';
      }
    });
  }
  
  // Temperature 슬라이더 값 표시
  const temperatureSlider = document.getElementById('temperature');
  const temperatureValue = document.getElementById('temperature-value');
  
  if (temperatureSlider && temperatureValue) {
    temperatureSlider.addEventListener('input', (e) => {
      temperatureValue.textContent = e.target.value;
    });
  }
  
  // Initialize character counters
  function updateCharCount(textarea, counterId) {
    const count = textarea.value.length;
    const counter = document.getElementById(counterId);
    if (counter) {
      counter.textContent = count;
      
      // Change color if approaching or exceeding limit
      const maxLength = parseInt(counter.textContent.split('/')[1]);
      if (count > maxLength * 0.9) {
        counter.style.color = '#ef4444'; // Red for approaching or exceeding limit
      } else {
        counter.style.color = '#9ca3af'; // Default gray
      }
    }
  }

  // Initialize character count for all textareas
  document.addEventListener('input', function(e) {
    const textarea = e.target;
    if (textarea.id === 'ai-greeting') {
      updateCharCount(textarea, 'greeting-count');
    } else if (textarea.id === 'training-data') {
      updateCharCount(textarea, 'training-count');
    } else if (textarea.id === 'instruction-data') {
      updateCharCount(textarea, 'instruction-count');
    }
  });

  // GPT Setting tab click handler
  document.getElementById('gptsetting')?.addEventListener('click', () => {
    switchTab('gpt-setting');
    if (window.innerWidth <= 768) {
      toggleSidebar();
    }
  });

  // Initialize save buttons
  function initializeSaveButtons() {
    // First save button (inside form)
    const gptSettingsForm = document.getElementById('gpt-settings-form');
    if (gptSettingsForm) {
        gptSettingsForm.addEventListener('submit', function(e) {
            e.preventDefault();
            savePrompt(e);
        });
    }

    // Second save button (outside form)
    const savePromptBtn = document.getElementById('save-prompt-btn');
    if (savePromptBtn) {
        savePromptBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation(); // Prevent event bubbling
            savePrompt(e);
        });
    }
    
    // 프롬프트 설정 폼 저장 버튼 이벤트 리스너 추가
    const promptSettingsForm = document.getElementById('prompt-settings-form');
    if (promptSettingsForm) {
        promptSettingsForm.addEventListener('submit', function(e) {
            e.preventDefault();
            savePrompt(e);
        });
    }
  }

  // Initialize buttons when DOM is ready
  if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initializeSaveButtons);
  } else {
      initializeSaveButtons();
  }

  // 저장된 설정이 있다면 불러오기
  function loadSavedSettings() {
    // 실제로는 서버에서 설정을 불러오는 API 호출이 필요합니다.
    // 예: fetch('/api/gpt-settings').then(...)
    
    // 예시: 로컬 스토리지에서 설정 불러오기 (임시)
    const savedSettings = localStorage.getItem('gptSettings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        if (apiKeyInput) apiKeyInput.value = settings.apiKey || '';
        
        const modelSelect = document.getElementById('gpt-model');
        if (modelSelect && settings.model) {
          modelSelect.value = settings.model;
        }
        
        if (temperatureSlider) {
          temperatureSlider.value = settings.temperature || 0.7;
          temperatureValue.textContent = settings.temperature || '0.7';
        }
      } catch (e) {
        console.error('설정을 불러오는 중 오류가 발생했습니다.', e);
      }
    }
  }
  
  // 모든 설정을 불러와 폼에 채우는 함수
  async function loadAllSettings(retryCount = 0) {
    try {
      // 로딩 중 UI 업데이트
      setInputsDisabled(true);
      
      // 백엔드 API에서 설정 데이터 가져오기
      const response = await fetch('/api/load-settings', {
        method: 'GET',
        headers: { ...authHeaders(), 'Content-Type': 'application/json', 'Accept': 'application/json' }
      });
      if (!response.ok) throw new Error('데이터를 불러오는데 실패했습니다.');
      
      const result = await response.json();
      const settings = result.data; // 백엔드 API 응답 구조에 맞춤
      
      // 불러온 데이터 콘솔 출력 (디버깅용)
      console.log('로드된 설정:', settings);
      
      if (settings) {
        try {
          // 1. 프롬프트 데이터 설정
          const setValue = (id, value) => {
            const element = document.getElementById(id);
            if (element) {
              element.value = value || '';
              console.log(`Set ${id}:`, value, typeof value);
            } else {
              console.error(`Element with id '${id}' not found`);
            }
          };
          
          // 2. HTML 요소 존재 여부 확인
          console.log('Checking HTML elements...');
          console.log('gpt-model exists:', !!document.getElementById('gpt-model'));
          console.log('temperature exists:', !!document.getElementById('temperature'));
          console.log('max-tokens exists:', !!document.getElementById('max-tokens'));
          
          // 3. 프롬프트 데이터 설정 (시트/백엔드 필드명과 HTML id 매핑)
          if ('aiGreeting' in settings) setValue('ai-greeting', settings.aiGreeting);
          if ('trainingData' in settings) setValue('training-data', settings.trainingData);
          if ('instructionData' in settings) setValue('instruction-data', settings.instructionData);
          
          // 4. GPT 설정 (시트/백엔드 필드명과 HTML id 매핑)
          // 모델 선택 (select) - 백엔드에서 내려오는 값을 HTML select 옵션의 value와 일치시킴
          const modelMap = {
            'GPT-4o-mini': 'gpt-4o-mini',
            'GPT-4o': 'gpt-4o',
            'GPT-5-mini': 'gpt-5-mini',
            'GPT-5': 'gpt-5'
          };
          
          const modelFromSettings = settings['gpt-model'] || 'GPT-4o-mini';
          const modelValue = modelMap[modelFromSettings] || 'gpt-4o-mini';
          const temperatureValue = settings.temperature ? Number(settings.temperature) : 0.7;
          const maxTokensValue = settings['max-tokens'] ? Number(settings['max-tokens']) : 2048;
          
          console.log('Setting values:', {
            'gpt-model': modelValue,
            temperature: temperatureValue,
            'max-tokens': maxTokensValue
          });
          
          // 값 설정
          setValue('gpt-model', modelValue);
          setValue('temperature', temperatureValue);
          setValue('max-tokens', maxTokensValue);
          
          // 5. 슬라이더 값 업데이트
          updateSliderValue('temperature');
          
          // 6. 토글 설정 업데이트
          if ('references' in settings) {
            const toggleReferences = document.getElementById('toggle-references');
            if (toggleReferences) {
              toggleReferences.checked = settings.references === true;
              localStorage.setItem('referencesEnabled', settings.references);
            }
          }
          
          if ('download-button' in settings) {
            const toggleDownloadButton = document.getElementById('toggle-download-button');
            if (toggleDownloadButton) {
              toggleDownloadButton.checked = settings['download-button'] === true;
              localStorage.setItem('downloadButtonEnabled', settings['download-button']);
            }
          }
          
          // 7. 글자 수 업데이트
          updateCharCount(document.getElementById('ai-greeting'), 'greeting-count');
          updateCharCount(document.getElementById('training-data'), 'training-count');
          updateCharCount(document.getElementById('instruction-data'), 'instruction-count');
        } catch (error) {
          console.error('Error while setting values:', error);
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      // 재시도 로직: 최대 3번까지 재시도
      if (retryCount < 3) {
        console.log(`설정 로드 실패, ${retryCount + 1}번째 재시도...`);
        showNotification(`설정 로드 실패, ${retryCount + 1}번째 재시도 중...`, 'warning');
        // 2초 후 재시도
        setTimeout(() => {
          loadAllSettings(retryCount + 1);
        }, 2000);
        return;
      } else {
        // 최대 재시도 횟수 초과 시 에러 표시
        showNotification('설정을 불러오는데 실패했습니다. 잠시 후 다시 시도해주세요.', 'error');
        // 재시도 버튼 표시
        showRetryButton();
      }
    } finally {
      // 에러가 발생하지 않았을 때만 입력 필드 활성화
      if (retryCount === 0 || retryCount >= 3) {
      setInputsDisabled(false);
      }
    }
  }
  
  // 재시도 버튼 표시 함수
  function showRetryButton() {
    // 기존 재시도 버튼이 있다면 제거
    const existingRetryBtn = document.getElementById('retry-settings-btn');
    if (existingRetryBtn) {
      existingRetryBtn.remove();
    }
    
    // 재시도 버튼 생성
    const retryBtn = document.createElement('button');
    retryBtn.id = 'retry-settings-btn';
    retryBtn.className = 'retry-btn';
    retryBtn.innerHTML = '🔄 설정 다시 불러오기';
    retryBtn.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #3b82f6;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      z-index: 1001;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    `;
    
    // 재시도 버튼 클릭 이벤트
    retryBtn.addEventListener('click', () => {
      retryBtn.remove();
      loadAllSettings();
    });
    
    document.body.appendChild(retryBtn);
  }
  
  // 토글 설정 불러오기
  async function loadToggleSettings() {
    try {
      // 외부 API 호출 대신 localStorage에서 설정을 불러오거나 기본값 사용
      const toggleReferences = document.getElementById('toggle-references');
      const toggleDownloadButton = document.getElementById('toggle-download-button');
      
      if (toggleReferences) {
        const savedReferences = localStorage.getItem('referencesEnabled');
        if (savedReferences !== null) {
          toggleReferences.checked = savedReferences === 'true';
        }
      }
      
      if (toggleDownloadButton) {
        const savedDownloadButton = localStorage.getItem('downloadButtonEnabled');
        if (savedDownloadButton !== null) {
          toggleDownloadButton.checked = savedDownloadButton === 'true';
        }
      }
      
      console.log('Toggle settings loaded successfully');
    } catch (error) {
      console.error('Error loading toggle settings:', error);
      // 기본값 사용 (이미 HTML에 설정됨)
    }
  }
  
  // 페이지 로드 시 토글 설정 불러오기
  loadToggleSettings();

  // 참조 데이터 수량 선택 관련 기능
  const quantityInput = document.getElementById('dataQuantity');
  const decreaseBtn = document.getElementById('decreaseQuantity');
  const increaseBtn = document.getElementById('increaseQuantity');
  const referenceDataItems = document.getElementById('referenceDataItems');
  const referenceDataForm = document.getElementById('reference-data-form');
  
  // 수량 변경 시 참조 데이터 항목 업데이트
  function updateReferenceDataItems(quantity) {
    if (!referenceDataItems) return;
    referenceDataItems.innerHTML = '';
    
    // 화면 크기에 따라 컬럼 수 조정
    const screenWidth = window.innerWidth;
    let columns = 3; // 기본 3열
    if (screenWidth < 1200) columns = 2;
    if (screenWidth < 768) columns = 1;
    
    // 그리드 템플릿 컬럼 업데이트
    referenceDataItems.style.gridTemplateColumns = `repeat(${columns}, minmax(280px, 1fr))`;
    
    // 각 항목 생성
    for (let i = 1; i <= quantity; i++) {
      const item = document.createElement('div');
      item.className = 'reference-item';
      item.innerHTML = `
        <h4>참조 데이터 ${i}</h4>
        <div class="form-group">
          <label for="ref-title-${i}">제목</label>
          <input type="text" id="ref-title-${i}" class="form-input" placeholder="참조 데이터 제목을 입력하세요">
        </div>
        <div class="form-group">
          <label for="ref-url-${i}">URL</label>
          <div class="input-with-button">
            <input type="url" id="ref-url-${i}" class="form-input" placeholder="https://example.com">
          </div>
        </div>
        <div class="form-group" style="flex: 1; display: flex; flex-direction: column;">
          <label for="ref-description-${i}">설명 (선택사항)</label>
          <textarea 
            id="ref-description-${i}" 
            class="form-textarea" 
            style="flex: 1; min-height: 80px;" 
            placeholder="참조 데이터에 대한 간단한 설명을 입력하세요"
          ></textarea>
        </div>
      `;
      referenceDataItems.appendChild(item);
    }
    
    // 창 크기 변경 이벤트 리스너 추가
    window.addEventListener('resize', handleResize);
  }
  
  // 폼 제출 처리
  if (referenceDataForm) {
    referenceDataForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const quantity = parseInt(quantityInput.value);
      const referenceData = [];
      
      // 모든 참조 데이터 수집
      for (let i = 1; i <= quantity; i++) {
        const title = document.getElementById(`ref-title-${i}`)?.value.trim();
        const url = document.getElementById(`ref-url-${i}`)?.value.trim();
        const description = document.getElementById(`ref-description-${i}`)?.value.trim();
        
        // 필수 필드 확인
        if (title && url) {
          referenceData.push({
            title,
            url,
            description: description || ''
          });
        }
      }
      
      // 여기서 서버로 데이터 전송
      console.log('참조 데이터 저장:', referenceData);
      showNotification('참조 데이터가 저장되었습니다.', 'success');
      
      // 로컬 스토리지에 저장 (데모용)
      localStorage.setItem('referenceData', JSON.stringify({
        quantity,
        items: referenceData
      }));
    });
  }
  
  // 창 크기 변경 핸들러
  function handleResize() {
    if (!referenceDataItems) return;
    const screenWidth = window.innerWidth;
    let columns = 3;
    if (screenWidth < 1200) columns = 2;
    if (screenWidth < 768) columns = 1;
    referenceDataItems.style.gridTemplateColumns = `repeat(${columns}, minmax(280px, 1fr))`;
  }
  
  // Chatbot Connection Functions
  async function checkChatbotStatus(url) {
    if (!url) return;
    
    // Show loading state
    updateStatus('checking', '연결 확인 중...');
    
    try {
      // Use GET method instead of HEAD as it's more widely supported
      const response = await fetch(url, {
        method: 'GET',
        mode: 'no-cors',
        cache: 'no-store',
        // Add headers to minimize data transfer
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      
      // Even with no-cors mode, we can't read the response, but the request was sent
      // So we'll assume if we get here, the endpoint is reachable
      updateStatus('online', '온라인');
      updateIframePreview(url);
      // Save the working URL
      localStorage.setItem('chatbotUrl', url);
      
      // Update preview status
      previewStatus.textContent = '챗봇이 정상적으로 연결되었습니다.';
      noPreview.style.display = 'none';
      chatbotIframe.style.display = 'block';
      
    } catch (error) {
      console.error('Error checking chatbot status:', error);
      updateStatus('offline', '오프라인');
      // Show error in preview
      previewStatus.textContent = '챗봇에 연결할 수 없습니다.';
      noPreview.style.display = 'block';
      chatbotIframe.style.display = 'none';
    }
    
    updateLastChecked();
  }
  
  function updateStatus(status, text) {
    // Update status indicator
    const indicator = document.querySelector('.status-indicator');
    if (indicator) {
      indicator.className = 'status-indicator';
      indicator.classList.add(status);
    }
    
    // Update status text and value
    if (connectionStatus) {
      connectionStatus.textContent = text;
      connectionStatus.className = 'status-value';
      connectionStatus.classList.add(status);
    }
    
    // Update preview status badge
    if (previewStatus) {
      previewStatus.className = 'status-badge';
      previewStatus.classList.add(status);
      previewStatus.textContent = text;
      
      // Update status button text and state
      const statusBtn = document.getElementById('check-status-btn');
      if (statusBtn) {
        statusBtn.disabled = status === 'checking';
      }
    }
    
    // Update status button text
    const statusBtnText = checkStatusBtn?.querySelector('span:last-child');
    if (statusBtnText) {
      statusBtnText.textContent = text === '확인 중...' ? '확인 중...' : '상태 확인';
    }
    
    // Update status button indicator
    const statusBtnIndicator = checkStatusBtn?.querySelector('.status-indicator');
    if (statusBtnIndicator) {
      statusBtnIndicator.className = 'status-indicator';
      statusBtnIndicator.classList.add(status);
    }
  }
  
  function updateLastChecked() {
    if (!lastChecked) return;
    
    const now = new Date();
    const timeString = now.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    lastChecked.textContent = timeString;
  }
  
  function updateIframePreview(url) {
    if (!chatbotIframe || !noPreview) return;
    
    if (url) {
      chatbotIframe.src = url;
      chatbotIframe.style.display = 'block';
      noPreview.style.display = 'none';
    } else {
      chatbotIframe.src = '';
      chatbotIframe.style.display = 'none';
      noPreview.style.display = 'flex';
    }
  }
  
  function showIframeCodeModal(url) {
    if (!iframeModal || !iframeCode) return;
    
    const iframeHtml = `<iframe 
                  src="${url}" 
                  width="100%" 
                  height="600" 
                  frameborder="0" 
                  style="border: 1px solid #e5e7eb; border-radius: 0.375rem;"
                  allowfullscreen>
                </iframe>`;
    
    iframeCode.textContent = iframeHtml;
    iframeModal.classList.add('show');
  }
  
  async function copyIframeCodeToClipboard() {
    if (!iframeCode) return;
    
    try {
      await navigator.clipboard.writeText(iframeCode.textContent);
      showNotification('코드가 클립보드에 복사되었습니다!', 'success');
    } catch (err) {
      console.error('Failed to copy: ', err);
      showNotification('코드 복사에 실패했습니다.', 'error');
    }
  }
  
  // 알림을 표시할 컨테이너 생성
  const notificationContainer = document.createElement('div');
  notificationContainer.id = 'notification-container';
  notificationContainer.style.position = 'fixed';
  notificationContainer.style.top = '20px';
  notificationContainer.style.right = '20px';
  notificationContainer.style.zIndex = '1000';
  document.body.appendChild(notificationContainer);

  function showNotification(message, type = 'info') {
    // 알림 요소 생성
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // 알림을 컨테이너에 추가
    notificationContainer.appendChild(notification);
    
    // 3초 후에 알림 제거
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        notification.remove();
      }, 300);
    }, 3000);
  }

  // 입력 필드들 비활성화/활성화 함수
  function setInputsDisabled(disabled) {
    const inputs = [
      document.getElementById('ai-greeting'),
      document.getElementById('training-data'),
      document.getElementById('instruction-data')
    ];
    
    inputs.forEach(input => {
      if (input) {
        input.disabled = disabled;
        input.placeholder = disabled ? '데이터를 불러오는 중입니다...' : '';
      }
    });
    
    // 로딩 메시지 표시/숨김
    const loadingElements = document.querySelectorAll('.loading-message');
    if (loadingElements.length === 0 && disabled) {
      // 로딩 메시지 추가 (이미 있으면 추가하지 않음)
      const loadingHtml = `
        <div class="loading-message" style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(255, 255, 255, 0.9);
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          z-index: 1000;
          text-align: center;
        ">
          <div class="spinner" style="
            border: 4px solid #f3f3f3;
            border-top: 4px solid #3498db;
            border-radius: 50%;
            width: 30px;
            height: 30px;
            animation: spin 1s linear infinite;
            margin: 0 auto 10px;
          "></div>
          <p>데이터를 불러오는 중입니다...</p>
        </div>
        <style>
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .form-textarea-container {
            position: relative;
          }
          .form-textarea[disabled] {
            opacity: 0.7;
            background-color: #f8f9fa;
          }
        </style>
      `;
      
      // 각 텍스트에어리어 컨테이너에 로딩 메시지 추가
      document.querySelectorAll('.form-group').forEach(container => {
        const textarea = container.querySelector('.form-textarea');
        if (textarea) {
          const wrapper = document.createElement('div');
          wrapper.className = 'form-textarea-container';
          wrapper.style.position = 'relative';
          textarea.parentNode.insertBefore(wrapper, textarea);
          wrapper.appendChild(textarea);
          wrapper.insertAdjacentHTML('beforeend', loadingHtml);
        }
      });
    } else if (!disabled) {
      // 로딩 완료 시 로딩 메시지 제거
      loadingElements.forEach(el => el.remove());
    }
  }

  // 프롬프트 데이터를 가져와 폼에 채우는 함수
  async function loadPromptData() {
    try {
      // 입력 필드 비활성화 및 로딩 상태 표시
      setInputsDisabled(true);
      
      const response = await fetch('/api/load-settings', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('프롬프트 데이터를 가져오는데 실패했습니다.');
      }
      
      const result = await response.json();
      const item = result.data; // 백엔드 API 응답 구조에 맞춤
      
      // 데이터가 있으면 각 필드에 할당
      if (item) {
        const greetingField = document.getElementById('ai-greeting');
        const trainingField = document.getElementById('training-data');
        const instructionField = document.getElementById('instruction-data');
        
        if (greetingField) greetingField.value = item.aiGreeting || '';
        if (trainingField) trainingField.value = item.trainingData || '';
        if (instructionField) instructionField.value = item.instructionData || '';
        
        // 문자 수 업데이트
        if (greetingField) updateCharCount(greetingField, 'greeting-count');
        if (trainingField) updateCharCount(trainingField, 'training-count');
        if (instructionField) updateCharCount(instructionField, 'instruction-count');
        
        console.log('프롬프트 데이터를 성공적으로 불러왔습니다.');
      }
    } catch (error) {
      console.error('프롬프트 데이터 로드 중 오류 발생:', error);
      showNotification('프롬프트 데이터를 불러오는 중 오류가 발생했습니다.', 'error');
    } finally {
      // 로딩 완료 후 입력 필드 다시 활성화
      setInputsDisabled(false);
    }
  }

  // GPT 설정 저장 핸들러
  async function saveGptSettings(event) {
    event.preventDefault();
    
    const model = document.getElementById('gpt-model').value;
    const temperature = parseFloat(document.getElementById('temperature').value);
    const maxTokens = parseInt(document.getElementById('max-tokens').value);
    
    try {
      const response = await fetch('/api/save-gpt-settings', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, temperature, max_tokens: maxTokens }),
        credentials: 'same-origin'
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || result.error || '설정 저장에 실패했습니다.');
      showNotification('GPT 설정이 성공적으로 저장되었습니다.', 'success');
    } catch (error) {
      console.error('Error saving GPT settings:', error);
      showNotification(error.message || '설정 저장 중 오류가 발생했습니다.', 'error');
    }
  }
  
  // 저장된 GPT 설정 불러오기
  async function loadGptSettings() {
    try {
      const response = await fetch('/api/load-settings', { headers: authHeaders() });
      if (!response.ok) throw new Error('Failed to load settings');
      
      const result = await response.json();
      const settings = result.data; // 백엔드 API 응답 구조에 맞춤
      
      // 설정이 있으면 폼에 적용
      if (settings) {
        const modelSelect = document.getElementById('gpt-model');
        const temperatureInput = document.getElementById('temperature');
        const maxTokensInput = document.getElementById('max-tokens');
        
        if (modelSelect && settings['gpt-model']) {
          modelSelect.value = settings['gpt-model'];
        }
        
        if (temperatureInput && settings.temperature !== undefined) {
          temperatureInput.value = settings.temperature;
          // 슬라이더 값 업데이트
          updateSliderValue('temperature');
        }
        
        if (maxTokensInput && settings['max-tokens'] !== undefined) {
          maxTokensInput.value = settings['max-tokens'];
        }
      }
    } catch (error) {
      console.error('Error loading GPT settings:', error);
      // 기본값 사용 (이미 HTML에 설정됨)
    }
  }
  
  // 슬라이더 값 업데이트 함수
  function updateSliderValue(sliderId) {
    const slider = document.getElementById(sliderId);
    const valueSpan = document.getElementById(`${sliderId}-value`);
    if (slider && valueSpan) {
      valueSpan.textContent = slider.value;
    }
  }

  // 프롬프트 폼 및 저장 버튼 show/hide 통합 관리
  setupPromptForm();
  
  // 프롬프트 설정 섹션과 저장 버튼을 보이도록 설정
  showPromptCategorySection(true);

  function showPromptCategorySection(show) {
    const form = document.getElementById('prompt-settings-form');
    const saveBtn = document.getElementById('save-prompt-btn'); // id 통일
    if (form) form.style.display = show ? 'block' : 'none';
    if (saveBtn) saveBtn.style.display = show ? 'block' : 'none';
  }
  
  // 프롬프트 설정 저장 버튼 상태 관리 개선
  function setupPromptSaveButton() {
    const savePromptBtn = document.getElementById('save-prompt-btn');
    if (savePromptBtn) {
      // 저장 버튼에 로딩 상태 클래스 추가
      savePromptBtn.classList.add('save-btn-with-loading');
      
      // 저장 버튼 클릭 이벤트
      savePromptBtn.addEventListener('click', async function(e) {
        e.preventDefault();
        try {
          await savePrompt(e);
          showSaveMessage('프롬프트 설정이 성공적으로 저장되었습니다!', 'success');
        } catch (error) {
          console.error('프롬프트 저장 중 오류 발생:', error);
          showSaveMessage(error.message || '저장 중 오류가 발생했습니다.', 'error');
        }
      });
    }
  }

  // Initialize GPT settings form event listeners
  (function initGptSettings() {
    const temperatureSlider = document.getElementById('temperature');
    
    // Remove form submission handler since we're using a single save button
    const gptSettingsForm = document.getElementById('gpt-settings-form');
    if (gptSettingsForm) {
      gptSettingsForm.onsubmit = (e) => {
        e.preventDefault();
        savePrompt();
      };
    }
    
    // Keep temperature slider value update
    if (temperatureSlider) {
      temperatureSlider.addEventListener('input', () => updateSliderValue('temperature'));
    }
  })();

  // 프롬프트 카테고리 탭 클릭 시만 폼/버튼 보이기
  document.getElementById('promptsetting')?.addEventListener('click', () => {
    showPromptCategorySection(true);
  });
  // 다른 탭 클릭 시 폼/버튼 숨김
  ['chatbotconnect','gptsetting','datasetting','referencedatasetting'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => {
      showPromptCategorySection(false);
    });
  });

  // 초기 참조 데이터 로드
  const savedData = localStorage.getItem('referenceData');
  if (savedData) {
    try {
      const { quantity, items } = JSON.parse(savedData);
      if (quantity >= 3 && quantity <= 6) {
        quantityInput.value = quantity;
        updateReferenceDataItems(quantity);
        
        // 저장된 데이터로 폼 채우기
        items.forEach((item, index) => {
          const i = index + 1;
          const titleInput = document.getElementById(`ref-title-${i}`);
          const urlInput = document.getElementById(`ref-url-${i}`);
          const descInput = document.getElementById(`ref-description-${i}`);
          
          if (titleInput) titleInput.value = item.title;
          if (urlInput) urlInput.value = item.url;
          if (descInput) descInput.value = item.description || '';
        });
        
        // 버튼 상태 업데이트
        decreaseBtn.disabled = quantity <= 3;
        increaseBtn.disabled = quantity >= 6;
      }
    } catch (e) {
      console.error('저장된 데이터를 불러오는 중 오류 발생:', e);
      // 기본값으로 초기화
      updateReferenceDataItems(3);
    }
  } else {
    // 기본값으로 초기화
    updateReferenceDataItems(3);
  }

  // 파일 업로드 관련 전역 변수 추가
  window.filesToUpload = [];
  window.fileList = null;
  window.startUploadBtn = null;

// 파일 업로드 초기화 함수
function initializeFileUpload() {
  console.log('=== 파일 업로드 시스템 초기화 시작 ===');
  
  // 전역 변수 초기화
  filesToUpload = [];
  fileList = document.getElementById('file-list');
  startUploadBtn = document.getElementById('start-upload');
  
  console.log('fileList element:', fileList);
  console.log('startUploadBtn:', startUploadBtn);
  
  if (!fileList) {
    console.error('fileList element not found!');
    return;
  }
  
  // 파일 입력 요소
  const fileInput = document.getElementById('file-input');
  const dropZone = document.getElementById('drop-zone');
  
  // 파일 선택 이벤트 리스너
  if (fileInput) {
    fileInput.addEventListener('change', function(e) {
      console.log('File input changed, files:', e.target.files);
      handleFiles(e.target.files);
    });
  } else {
    console.error('file-input element not found!');
  }
  
  // 드래그 앤 드롭 이벤트 리스너
  if (dropZone) {
    dropZone.addEventListener('dragover', function(e) {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });
    
    dropZone.addEventListener('dragleave', function(e) {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
    });
    
    dropZone.addEventListener('drop', function(e) {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      const files = e.dataTransfer.files;
      handleFiles(files);
    });
  }
  
  // 업로드 시작 버튼 이벤트 리스너
  if (startUploadBtn) {
    startUploadBtn.addEventListener('click', startUpload);
  }
  
  // 초기 파일 목록 업데이트
  updateFileList();
  
  console.log('=== 파일 업로드 시스템 초기화 완료 ===');
}

// 파일 업로드 시작 함수
function startUpload() {
  if (filesToUpload.length === 0) {
    showNotification('업로드할 파일을 선택해주세요.', 'warning');
    return;
  }

  // 업로드 버튼 비활성화
  if (startUploadBtn) {
    startUploadBtn.disabled = true;
    startUploadBtn.textContent = '업로드 중...';
  }

  // 파일 업로드 시작
  filesToUpload.forEach((file) => {
    uploadFile(file);
  });
}

// 파일 업로드 함수
async function uploadFile(file) {
  try {
    // FormData 생성
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch('/api/upload', {
      method: 'POST',
      headers: authHeaders(),
      body: formData
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const msg = error.detail || error.error || error.message || `업로드 실패 (HTTP ${response.status})`;
      throw new Error(msg);
    }

    const result = await response.json();
    showNotification(`파일 ${file.name} 업로드 성공!`, 'success');
    
    // 파일 목록에서 제거
    const index = filesToUpload.findIndex(f => f.name === file.name);
    if (index > -1) {
      filesToUpload.splice(index, 1);
    }
    updateFileList();
    
    // 2초 뒤 문서 목록 자동 새로고침
    if (typeof loadDocumentList === 'function') {
      setTimeout(() => {
        try { loadDocumentList(); } catch (e) { console.warn('문서 목록 새로고침 실패:', e); }
      }, 2000);
    }
    
  } catch (error) {
    console.error('파일 업로드 오류:', error);
    showNotification(`파일 ${file.name} 업로드 실패: ${error.message}`, 'error');
  } finally {
    // 업로드 버튼 상태 복원
    if (startUploadBtn) {
      startUploadBtn.disabled = filesToUpload.length === 0;
      startUploadBtn.textContent = '업로드 시작';
    }
  }
}

// 파일 처리 함수
function handleFiles(selectedFiles) {
  console.log('handleFiles called with files:', selectedFiles);

  if (!selectedFiles || selectedFiles.length === 0) {
    console.log('No files selected');
    return;
  }

  let filesAdded = 0;

  // Convert to array and process each file
  Array.from(selectedFiles).forEach(file => {
    console.log('Processing file:', file.name, 'size:', file.size, 'type:', file.type);
  
    // Check if file is valid
    if (!isFileValid(file)) {
      console.log('File is invalid:', file.name);
      return;
    }
  
    // Check for duplicate files
    const isDuplicate = filesToUpload.some(
      existingFile => existingFile.name === file.name && existingFile.size === file.size
    );
  
    if (isDuplicate) {
      console.log('Duplicate file skipped:', file.name);
      showNotification(`이미 추가된 파일입니다: ${file.name}`, 'warning');
      return;
    }
  
    // Add file to upload queue
    console.log('Adding file to upload queue:', file.name);
    filesToUpload.push(file);
    filesAdded++;
  });

  // Update the UI
  if (filesAdded > 0) {
    console.log(`Added ${filesAdded} new files to upload queue`);
    updateFileList();
  } else if (filesToUpload.length === 0) {
    // Show message if no valid files were added
    showNotification('유효한 파일을 선택해주세요.', 'warning');
  }
}

// 파일 유효성 검사
function isFileValid(file) {
  const fileExt = file.name.split('.').pop().toLowerCase();
  const allowedTypes = ['pdf', 'txt', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];
  
  if (!allowedTypes.includes(fileExt)) {
    showNotification(`지원하지 않는 파일 형식입니다: ${file.name}`, 'error');
    return false;
  }
  
  if (file.size > 50 * 1024 * 1024) { // 50MB
    showNotification(`파일 크기가 너무 큽니다 (최대 50MB): ${file.name}`, 'error');
    return false;
  }
  
  // 중복 파일 체크
  const isDuplicate = filesToUpload.some(
    existingFile => existingFile.name === file.name && 
                   existingFile.size === file.size
  );
  
  if (isDuplicate) {
    showNotification(`이미 추가된 파일입니다: ${file.name}`, 'warning');
    return false;
  }
  
  return true;
}

// 파일 목록 업데이트 함수
function updateFileList() {
  console.log('updateFileList called. filesToUpload length:', filesToUpload.length);

  // Get the file list element
  const fileList = document.getElementById('file-list');
  const startUploadBtn = document.getElementById('start-upload');

  if (!fileList) {
    console.error('fileList element not found!');
    return;
  }

  // Clear the file list
  fileList.innerHTML = '';

  if (filesToUpload.length === 0) {
    console.log('No files to display, showing empty state');
    fileList.innerHTML = '<div class="text-gray-500 text-sm py-2">선택된 파일이 없습니다.</div>';
    if (startUploadBtn) {
      startUploadBtn.disabled = true;
    }
    return;
  }

  // Add each file to the list
  filesToUpload.forEach((file, index) => {
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    fileItem.dataset.index = index;

    const fileName = document.createElement('span');
    fileName.className = 'file-name';
    fileName.textContent = file.name;

    const removeButton = document.createElement('button');
    removeButton.className = 'remove-file';
    removeButton.textContent = '×';
    removeButton.dataset.index = index;

    // Add click event to remove button
    removeButton.addEventListener('click', (e) => {
      e.stopPropagation();
      const index = parseInt(e.target.dataset.index);
      console.log('Removing file at index:', index);
      filesToUpload.splice(index, 1);
      updateFileList();
    });

    fileItem.appendChild(fileName);
    fileItem.appendChild(removeButton);
    fileList.appendChild(fileItem);
  });

  // Enable/disable upload button
  if (startUploadBtn) {
    startUploadBtn.disabled = filesToUpload.length === 0;
  }

  console.log('File list updated with', filesToUpload.length, 'files');
}

// 파일 크기 포맷팅 함수
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 업로드 결과 표시 함수
function showUploadResult(message, type) {
  const resultDiv = document.getElementById('upload-result');
  if (resultDiv) {
    resultDiv.textContent = message;
    resultDiv.className = type; // 'success' 또는 'error' 클래스 적용
  }
}

// 파일 업로드 모달 제어 함수
function setupFileUploadModal() {
  const modal = document.getElementById('file-upload-modal');
  const closeBtn = document.getElementById('close-upload-modal');
  const cancelBtn = document.getElementById('cancel-upload');
  const uploadForm = document.getElementById('file-upload-form');
  const fileInput = document.getElementById('file-input');
  const browseBtn = document.getElementById('browse-btn');
  const dropZone = document.getElementById('drop-zone');
  const fileInfo = document.getElementById('file-info');
  const uploadSubmitBtn = document.getElementById('upload-submit-btn');
  
  // filesToUpload 초기화 (window 객체에 할당)
  window.filesToUpload = window.filesToUpload || [];
  
  // 모달 열기 함수
  window.openFileUploadModal = function() {
    if (modal) {
      modal.classList.remove('hidden');
      document.body.style.overflow = 'hidden'; // 스크롤 방지
    }
  };
  
  // 모달 닫기 함수
  function closeModal() {
    if (modal) {
      modal.classList.add('hidden');
      document.body.style.overflow = ''; // 스크롤 복원
    }
  }
  
  // 닫기 버튼 이벤트
  if (closeBtn) {
    closeBtn.addEventListener('click', closeModal);
  }
  
  // 취소 버튼 이벤트
  if (cancelBtn) {
    cancelBtn.addEventListener('click', closeModal);
  }
  
  // 모달 외부 클릭 시 닫기
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });
  
  // 파일 선택 이벤트
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      console.log('File input changed');
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
      }
    });
  }
  
  // 찾아보기 버튼 클릭 이벤트
  if (browseBtn && fileInput) {
    browseBtn.addEventListener('click', (e) => {
      e.preventDefault();
      fileInput.click();
    });
  }
  
  // 드래그 앤 드롭 이벤트
  if (dropZone) {
    // 드래그 오버 시 스타일 변경
    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('border-blue-500', 'bg-blue-50');
      }, false);
    });
    
    // 드래그 리브 시 스타일 원복
    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('border-blue-500', 'bg-blue-50');
      }, false);
    });
    
    // 파일 드롭 처리
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        console.log('Files dropped:', files.length);
        handleFiles(files);
      }
    }, false);
  }
  
  // 폼 제출 이벤트
  if (uploadForm) {
    uploadForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      if (!window.filesToUpload || window.filesToUpload.length === 0) {
        showNotification('업로드할 파일이 없습니다.', 'error');
        return;
      }
      
      try {
        // 업로드 버튼 비활성화 및 로딩 상태로 변경
        if (uploadSubmitBtn) {
          uploadSubmitBtn.disabled = true;
          uploadSubmitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 업로드 중...';
        }
        
        // 파일 업로드 실행
        await uploadFiles();
        
        // 성공 시 모달 닫기
        closeModal();
        
        // 파일 입력 초기화
        if (fileInput) {
          fileInput.value = '';
        }
        
      } catch (error) {
        console.error('Upload error:', error);
        showNotification('파일 업로드 중 오류가 발생했습니다: ' + error.message, 'error');
      } finally {
        // 업로드 버튼 상태 복원
        if (uploadSubmitBtn) {
          uploadSubmitBtn.disabled = false;
          uploadSubmitBtn.textContent = '업로드';
        }
      }
    });
  }
} // setupFileUploadModal 함수 종료

// 파일 업로드 함수 (모달용)
async function uploadFiles() {
  if (!window.filesToUpload || window.filesToUpload.length === 0) {
    throw new Error('업로드할 파일이 없습니다.');
  }

  const uploadPromises = window.filesToUpload.map(async (file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: authHeaders(),
        body: formData
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        const msg = error.detail || error.error || error.message || `업로드 실패 (HTTP ${response.status})`;
        throw new Error(msg);
      }

      // 성공 응답 파싱 및 Drive 스케줄링 경고 표시
      const respJson = await response.json().catch(() => ({}));
      if (respJson && respJson.drive_upload_scheduled === false) {
        showNotification('Google Drive 업로드 예약에 실패했습니다.', 'warning');
      }
      if (respJson && respJson.drive_upload_schedule_error) {
        showNotification(`Drive 업로드 예약 오류: ${respJson.drive_upload_schedule_error}`, 'error');
      }

      // 백그라운드 업로드 상태 폴링 (최대 30초)
      if (respJson && respJson.drive_upload_job_id) {
        try {
          const jobId = respJson.drive_upload_job_id;
          const start = Date.now();
          let lastStatus = 'pending';
          while (Date.now() - start < 30000) {
            const stRes = await fetch(`/api/upload/status/${encodeURIComponent(jobId)}`, { headers: authHeaders(), credentials: 'same-origin' });
            if (!stRes.ok) {
              const errText = await stRes.text().catch(() => '');
              showNotification(`Drive 상태 조회 실패 (HTTP ${stRes.status})${errText ? `: ${errText}` : ''}`, 'error');
              break;
            }
            const stJson = await stRes.json().catch(() => ({}));
            const s = stJson && stJson.data ? (stJson.data.status || 'unknown') : 'unknown';
            if (s !== lastStatus) {
              lastStatus = s;
            }
            if (s === 'success') {
              const link = stJson && stJson.data && stJson.data.drive_file ? stJson.data.drive_file.webViewLink : '';
              showNotification(`Drive 업로드 완료${link ? ` - <a href="${link}" target="_blank" rel="noopener">열기</a>` : ''}`, 'success');
              break;
            }
            if (s === 'error') {
              const detail = stJson && stJson.data ? (stJson.data.detail || '') : '';
              showNotification(`Drive 업로드 실패${detail ? `: ${detail}` : ''}`, 'error');
              break;
            }
            await new Promise(r => setTimeout(r, 1500));
          }
          if (lastStatus === 'pending' || lastStatus === 'unknown') {
            showNotification('Drive 업로드 상태를 확인하지 못했습니다 (타임아웃).', 'warning');
          }
        } catch (pollErr) {
          console.warn('Drive 업로드 상태 폴링 실패:', pollErr);
          showNotification('Drive 업로드 상태 확인 중 오류가 발생했습니다.', 'error');
        }
      }

      return { file, success: true, response: respJson };
    } catch (error) {
      console.error(`파일 ${file.name} 업로드 오류:`, error);
      return { file, success: false, error: error.message };
    }
  });

  const results = await Promise.all(uploadPromises);
  
  // 성공한 파일들 제거
  const successfulFiles = results.filter(r => r.success).map(r => r.file);
  successfulFiles.forEach(file => {
    const index = window.filesToUpload.findIndex(f => f.name === file.name);
    if (index > -1) {
      window.filesToUpload.splice(index, 1);
    }
  });

  // 결과 요약
  const successCount = successfulFiles.length;
  const totalCount = window.filesToUpload.length + successCount;
  
  if (successCount > 0) {
    showNotification(`${successCount}/${totalCount} 파일이 성공적으로 업로드되었습니다.`, 'success');
  }
  
  if (successCount < totalCount) {
    showNotification(`${totalCount - successCount}개 파일 업로드에 실패했습니다.`, 'error');
  }
  
  // 성공한 업로드가 하나 이상이면 2초 뒤 문서 목록 자동 새로고침
  if (successCount > 0 && typeof loadDocumentList === 'function') {
    setTimeout(() => {
      try { loadDocumentList(); } catch (e) { console.warn('문서 목록 새로고침 실패:', e); }
    }, 2000);
  }
}

// 페이지 로드 시 파일 업로드 초기화
setupFileUploadModal();

// ===== Chat history functions =====
// HTML escape utility to prevent XSS and render plain text safely
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
async function loadChatSessions() {
  try {
    // 이미 로드된 경우 재요청 방지
    if (chatSessionsLoaded || chatSessionsLoading) {
      // 정렬만 갱신
      setupSortOptions();
      displaySortedSessions('default');
      return;
    }
    chatSessionsLoading = true;
    const sidebar = document.querySelector('#chat-history-content .chat-list');
    const messages = document.querySelector('#chat-history-content .chat-messages');
    
    // 빠른 로딩 피드백
    if (sidebar) {
      sidebar.innerHTML = '<div class="loading-container"><div class="loading-spinner"></div><div class="loading-text">세션을 불러오는 중...</div></div>';
    }
    
    const res = await fetch('/api/chat/sessions', { headers: authHeaders(), credentials: 'same-origin' });
    if (!res.ok) throw new Error('세션 목록 로드 실패');
    
    const json = await res.json();
    chatSessionsData = json.data || []; // 전역 변수에 저장
    
    // 정렬 옵션 이벤트 리스너 설정 (중복 바인딩 방지)
    setupSortOptions();
    
    // 기본 정렬로 세션 표시 (상위 5개 미리 로딩 없음)
    displaySortedSessions('default');
    
    if (messages) {
      messages.innerHTML = '<div style="padding:8px;color:#9ca3af;">좌측에서 세션을 선택하세요. (순차적 로딩으로 변경됨)</div>';
    }
    chatSessionsLoaded = true;
  } catch (e) {
    console.error(e);
  } finally {
    chatSessionsLoading = false;
  }
}

// 전역에서 접근 가능하도록 노출 (로그인 성공 시 자동 로드에 사용)
window.loadChatSessions = loadChatSessions;

async function loadChatLogs(uuid) {
  try {
    const messages = document.querySelector('#chat-history-content .chat-messages');

    // 캐시된 로그가 있으면 즉시 렌더링
    const cached = chatLogsCache && chatLogsCache[uuid];
    if (cached && messages) {
      renderLogs(cached);
      return;
    }

    // 로딩 상태 표시 (더 빠른 피드백)
    if (messages) {
      messages.innerHTML = '<div class="loading-container"><div class="loading-spinner"></div><div class="loading-text">채팅을 불러오는 중...</div></div>';
    }
    
    // 순차적 로딩을 위한 지연 (사용자 경험 개선)
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const res = await fetch(`/api/chat/logs/${encodeURIComponent(uuid)}`, { headers: authHeaders(), credentials: 'same-origin' });
    if (!res.ok) throw new Error('채팅 로그 로드 실패');
    const json = await res.json();
    const logs = json.data || [];
    
    // 캐시에 저장 (메모리 효율성 향상)
    if (Object.keys(chatLogsCache).length > 50) {
      // 캐시가 너무 커지면 오래된 항목 제거
      const keys = Object.keys(chatLogsCache);
      const oldestKey = keys[0];
      delete chatLogsCache[oldestKey];
    }
    chatLogsCache[uuid] = logs;

    if (messages) {
      renderLogs(logs);
    }

    function renderLogs(logsToRender) {
      messages.innerHTML = logsToRender.map(l => {
        const type = (l.type || l.role || '').toLowerCase();
        const isBot = type === 'bot' || type === 'assistant';
        const isUser = type === 'user';
        const content = l.message || l.content || '';
        const ts = l.timestamp || '';
        const references = l.references || l.References || '';
        const referencesBtn = references ? `
          <div class="references-actions">
            <button class="references-chip" data-ref="${encodeURIComponent(references)}" title="참조 보기">참조 보기</button>
          </div>
        ` : '';
        if (isUser) {
          return `<div class="message message-user">
                    <div class="message-content-wrapper">
                      <div class="message-timestamp">${ts}</div>
                      <div class="message-content">${escapeHtml(content)}</div>
                    </div>
                  </div>`;
        } else {
          return `<div class="message message-bot">
                    <div class="message-content-wrapper">
                      <div class="message-content">${escapeHtml(content)}</div>
                      <div class="message-timestamp">${ts}</div>
                    </div>
                    ${referencesBtn}
                  </div>`;
        }
      }).join('');
      messages.querySelectorAll('.references-chip').forEach(btn => {
        btn.addEventListener('click', () => {
          const ref = btn.getAttribute('data-ref');
          const text = ref ? decodeURIComponent(ref) : '';
          showReferencesModal(text || '참조 데이터가 없습니다.');
        });
      });
    }
  } catch (e) {
    console.error('채팅 로그 로드 실패:', e);
    const messages = document.querySelector('#chat-history-content .chat-messages');
    if (messages) {
      messages.innerHTML = '<div style="padding:8px;color:#ef4444;">채팅 로그를 불러오는데 실패했습니다. 다시 시도해주세요.</div>';
    }
  }
}

// 상위 N개 세션의 로그를 백그라운드에서 미리 불러오기 (제거됨 - 순차적 로딩으로 변경)
// async function prefetchTopChatLogs(count = 5) {
//   try {
//     if (!Array.isArray(lastSortedSessions) || lastSortedSessions.length === 0) return;
//     const top = lastSortedSessions.slice(0, count);
//     const uuids = top.map(s => s.uuid || s.UUID || s.Uuid || Object.values(s)[0]).filter(Boolean);
//     const tasks = uuids.map(async (uuid) => {
//       if (chatLogsCache[uuid]) return; // 이미 캐시됨
//       try {
//         const res = await fetch(`/api/chat/logs/${encodeURIComponent(uuid)}`, { headers: authHeaders(), credentials: 'same-origin' });
//         if (!res.ok) return;
//         const json = await res.json().catch(() => ({}));
//         const logs = json.data || [];
//         chatLogsCache[uuid] = logs;
//       } catch (_) { /* ignore */ }
//     });
//     // 백그라운드 실행 (대기하지 않음)
//     Promise.allSettled(tasks);
//   } catch (_) { /* ignore */ }
// }

// 관리자 패널 기본 로딩 UI
function renderAdminPanelUI() {
  const listWrap = document.getElementById('admin-users-list');
  const permsGrid = document.getElementById('perms-grid');
  
  if (listWrap) {
    listWrap.innerHTML = `
      <div class="loading-container">
        <div class="loading-spinner"></div>
        <div class="loading-text">관리자 목록을 불러오는 중...</div>
      </div>
    `;
  }
  
  if (permsGrid) {
    permsGrid.innerHTML = `
      <div class="loading-container">
        <div class="loading-spinner"></div>
        <div class="loading-text">권한 설정을 불러오는 중...</div>
      </div>
    `;
  }
  
  // 이벤트 핸들러 설정
  setupAdminEventHandlers();
}

function setupSortOptions() {
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    // 중복 리스너 방지
    if (sortSelect.dataset.bound === 'true') return;
    sortSelect.dataset.bound = 'true';
    sortSelect.addEventListener('change', (e) => {
      const sortType = e.target.value;
      console.log('Sort option changed to:', sortType);
      
      // 정렬 변경 시 즉시 재정렬 및 표시
      displaySortedSessions(sortType);
      
      // 정렬 변경 알림
      const sortLabels = {
        'default': '최근 대화순',
        'messages-desc': '대화쌍 많은순',
        'messages-asc': '대화쌍 적은순',
        'text-desc': '텍스트 많은순',
        'text-asc': '텍스트 적은순'
      };
      
      const label = sortLabels[sortType] || sortType;
      showNotification(`정렬이 '${label}'으로 변경되었습니다.`, 'info');
    });
  }
}

function displaySortedSessions(sortType) {
  const sidebar = document.querySelector('#chat-history-content .chat-list');
  if (!sidebar || !chatSessionsData.length) return;
  
  let sortedSessions = [...chatSessionsData];
  
  switch (sortType) {
    case 'messages-desc':
      sortedSessions.sort((a, b) => {
        const countA = parseInt(a.message_count || a.count || a[Object.keys(a)[3]] || 0);
        const countB = parseInt(b.message_count || b.count || b[Object.keys(b)[3]] || 0);
        return countB - countA;
      });
      break;
      
    case 'messages-asc':
      sortedSessions.sort((a, b) => {
        const countA = parseInt(a.message_count || a.count || a[Object.keys(a)[3]] || 0);
        const countB = parseInt(b.message_count || b.count || b[Object.keys(b)[3]] || 0);
        return countA - countB;
      });
      break;
      
    case 'text-desc':
      sortedSessions.sort((a, b) => {
        const textA = (a.message_count || a.count || a[Object.keys(a)[3]] || 0) * 100; // 대략적인 텍스트 길이 추정
        const textB = (b.message_count || b.count || b[Object.keys(b)[3]] || 0) * 100;
        return textB - textA;
      });
      break;
      
    case 'text-asc':
      sortedSessions.sort((a, b) => {
        const textA = (a.message_count || b.count || a[Object.keys(a)[3]] || 0) * 100;
        const textB = (b.message_count || b.count || b[Object.keys(b)[3]] || 0) * 100;
        return textA - textB;
      });
      break;
      
    default:
      // 기본 순서: 대화의 끝시간(ended_at)을 기준으로 최신 대화가 맨 위에 오도록 정렬
      sortedSessions.sort((a, b) => {
        // ended_at (대화 종료 시간)을 우선으로 사용
        const timeA = new Date(a.ended_at || a.end || a[Object.keys(a)[2]] || 0);
        const timeB = new Date(b.ended_at || b.end || b[Object.keys(b)[2]] || 0);
        
        // 디버깅: 시간 정보 출력
        console.log(`Session A (${a.uuid || 'unknown'}): ended_at=${a.ended_at}, parsed=${timeA}`);
        console.log(`Session B (${b.uuid || 'unknown'}): ended_at=${b.ended_at}, parsed=${timeB}`);
        
        // 끝시간이 더 최근인 대화가 맨 위에 오도록 내림차순 정렬
        // 예: 2025.08.13이 2025.07.30보다 위에 표시됨
        const result = timeB - timeA;
        console.log(`Sort result: ${result} (${timeB} - ${timeA})`);
        return result;
      });
      break;
  }
  
  // 최근 정렬 상태 저장
  lastSortedSessions = sortedSessions;
  // 상위 5개 대화 로그 미리 불러오기 (제거됨 - 순차적 로딩으로 변경)
  // prefetchTopChatLogs(5);
  
  // 정렬된 세션 표시
  sidebar.innerHTML = sortedSessions.map((s, index) => {
    const uuid = s.uuid || s.UUID || s.Uuid || Object.values(s)[0];
    const started = s.started_at || s.start || s[Object.keys(s)[1]] || '';
    const ended = s.ended_at || s.end || s[Object.keys(s)[2]] || '';
    const count = s.message_count || s.count || s[Object.keys(s)[3]] || '';
    const references = s.references || s.References || ''; // E열의 references 데이터
    
    // 시간 표시 개선: ended_at이 있으면 ended_at을 우선 표시, 없으면 started_at 사용
    const displayTime = ended || started;
    const timeLabel = ended ? '종료' : '시작';
    
    // references 정보가 있는 경우 표시
    const referencesInfo = references ? `
      <div class="session-references">
        <span class="references-icon">📚</span>
        <span class="references-text">참조 자료 포함</span>
      </div>
    ` : '';
    
    // 정렬 순서 표시 (1, 2, 3...)
    const orderNumber = index + 1;
    
    return `<div class="chat-item" data-uuid="${uuid}" data-order="${orderNumber}">
             <div class="session-order">${orderNumber}</div>
             <div class="uuid-text">${uuid}</div>
             <div class="session-info">
               <div class="session-times">
                 <span class="time-label">시작:</span> ${started || '알 수 없음'}
                 ${ended ? `<br><span class="time-label">종료:</span> ${ended}` : ''}
               </div>
               <div class="session-meta">
                 <div class="meta-left">
                   <span class="message-count">${count}개 메시지</span>
                   <span class="sort-priority">${ended ? '종료시간 기준' : '시작시간 기준'}</span>
                 </div>
                 ${referencesInfo}
               </div>
             </div>
           </div>`;
  }).join('');
  
  // 클릭 이벤트 리스너 다시 설정
  sidebar.querySelectorAll('.chat-item').forEach(el => {
    el.addEventListener('click', () => {
      const uuid = el.getAttribute('data-uuid');
      
      // 이전 활성 세션 제거
      sidebar.querySelectorAll('.chat-item').forEach(i => i.classList.remove('active'));
      el.classList.add('active');
      
      // 로딩 상태 표시
      el.classList.add('loading');
      
      // 채팅 로그 로딩
      loadChatLogs(uuid).finally(() => {
        // 로딩 완료 후 로딩 상태 제거
        el.classList.remove('loading');
      });
    });
  });
  
  // 정렬 변경 애니메이션 효과
  setTimeout(() => {
    sidebar.querySelectorAll('.chat-item').forEach((el, index) => {
      el.classList.add('sorting');
      setTimeout(() => {
        el.classList.remove('sorting');
      }, 100 + (index * 50)); // 순차적으로 애니메이션 적용
    });
  }, 100);
}

// ===== References Modal Helpers =====
function ensureReferencesModal() {
  let modal = document.getElementById('references-modal');
  if (modal) return modal;
  
  modal = document.createElement('div');
  modal.id = 'references-modal';
  modal.className = 'references-modal';
  modal.innerHTML = `
    <div class="references-modal-box">
      <div class="references-modal-header">
        <span>참조 자료</span>
        <button class="references-modal-close" aria-label="닫기">×</button>
      </div>
      <div id="references-modal-body" class="references-modal-body"></div>
    </div>
  `;
  document.body.appendChild(modal);
  
  // 닫기 이벤트
  modal.addEventListener('click', (e) => {
    if (e.target.id === 'references-modal') hideReferencesModal();
  });
  modal.querySelector('.references-modal-close')?.addEventListener('click', hideReferencesModal);
  
  // ESC 닫기
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('show')) hideReferencesModal();
  });
  
  return modal;
}

function showReferencesModal(text) {
  const modal = ensureReferencesModal();
  const body = document.getElementById('references-modal-body');
  if (body) body.textContent = '';
  if (body) body.innerText = text; // 텍스트만 표시 (보안상)
  modal.classList.add('show');
}

function hideReferencesModal() {
  const modal = document.getElementById('references-modal');
  if (modal) modal.classList.remove('show');
}

}); // DOMContentLoaded 함수 종료

// ===== Authentication & Permissions =====
async function initAuthAndGuard() {
  try {
    const me = await apiGet('/api/admin/me');
    currentUserInfo = me.data;
    applyPermissionsToUI();
    // 로그아웃 버튼 추가
    addLogoutButton();
    // 로그인 상태로 UI 표시
    showLoggedInUI();
    // 채팅 세션 자동 로드는 UI 표시 후 백그라운드에서 시작
    if (typeof window.loadChatSessions === 'function') {
      setTimeout(() => window.loadChatSessions(), 0);
    }
  } catch (e) {
    console.error('me error', e);
    showLoginOverlay();
  }
}

function showLoginOverlay() {
  // 로그인하지 않은 상태로 UI 숨김
  hideLoggedInUI();
  
  const overlay = document.getElementById('login-overlay');
  if (!overlay) return;
  overlay.style.display = 'flex';
  const loginBtn = document.getElementById('admin-login-btn');
  const errBox = document.getElementById('login-error');
  const usernameEl = document.getElementById('admin-username');
  const passwordEl = document.getElementById('admin-password');
  if (loginBtn && usernameEl && passwordEl) {
    loginBtn.onclick = async () => {
      try {
        setSaveButtonLoading(loginBtn, true);
        errBox && (errBox.style.display = 'none');
        const username = usernameEl.value.trim();
        const password = passwordEl.value;
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.detail || '로그인 실패');
        // 쿠키에 토큰이 설정되므로 별도 저장 불필요
        overlay.style.display = 'none';
        // Fetch me and proceed
        const me = await apiGet('/api/admin/me');
        currentUserInfo = me.data;
        applyPermissionsToUI();
        // 로그아웃 버튼 추가
        addLogoutButton();
        // 로그인 상태로 UI 표시
        showLoggedInUI();
        // 무거운 데이터는 탭 클릭 시 로드
        showNotification('로그인 성공', 'success');
      } catch (err) {
        console.error(err);
        if (errBox) {
          errBox.textContent = err.message || '로그인 실패';
          errBox.style.display = 'block';
        }
      } finally {
        setSaveButtonLoading(loginBtn, false);
      }
    };
  }
}

// 로그아웃 버튼 추가 함수
function addLogoutButton() {
  // 기존 로그아웃 버튼이 있다면 제거
  const existingLogoutBtn = document.querySelector('.logout-btn');
  if (existingLogoutBtn) {
    existingLogoutBtn.remove();
  }
  
  // 사이드바 하단에 로그아웃 버튼 추가
  const sidebar = document.getElementById('sidebar');
  if (sidebar) {
    const logoutBtn = document.createElement('button');
    logoutBtn.className = 'action-btn logout-btn';
    logoutBtn.innerHTML = '<span>로그아웃</span>';
    logoutBtn.style.cssText = `
      margin-top: auto;
      margin-bottom: 1rem;
      background: #dc2626;
      border: 1px solid #b91c1c;
    `;
    
    logoutBtn.addEventListener('click', async () => {
      try {
        await fetch('/api/admin/logout', { 
          method: 'POST',
          credentials: 'same-origin'
        });
        showNotification('로그아웃되었습니다.', 'success');
        
        // UI 숨김
        hideLoggedInUI();
        
        // 로그인 화면 표시
        showLoginOverlay();
        
        // 사용자 정보 초기화
        currentUserInfo = null;
        
        // 권한 UI 초기화
        applyPermissionsToUI();
        
        // 로그아웃 버튼 제거
        logoutBtn.remove();
      } catch (error) {
        console.error('로그아웃 오류:', error);
        showNotification('로그아웃 중 오류가 발생했습니다.', 'error');
      }
    });
    
    sidebar.appendChild(logoutBtn);
  }
}

function applyPermissionsToUI() {
  if (!currentUserInfo) return;
  const perms = currentUserInfo.permissions || {};
  const isSuper = !!currentUserInfo.is_super_admin;
  // Sidebar buttons
  const map = {
    'chatbotconnect': 'chatbot-connect',
    'chatHistory': 'chat-history',
    'gptsetting': 'gpt-setting',
    'promptsetting': 'prompt-setting',
    'datasetting': 'data-setting',
    'referencedatasetting': 'reference-data'
  };
  Object.entries(map).forEach(([btnId, cat]) => {
    const btn = document.getElementById(btnId);
    const allowed = isSuper || (perms[cat] && perms[cat].can_view);
    if (btn) btn.style.display = allowed ? '' : 'none';
  });
  // Super admin: show admin button
  const adminBtn = document.getElementById('adminmanage');
  if (adminBtn) adminBtn.style.display = isSuper ? '' : 'none';

  // Save buttons enable/disable by can_save
  const savePromptBtn = document.getElementById('save-prompt-btn');
  if (savePromptBtn) {
    const canSavePrompt = isSuper || (perms['prompt-setting'] && perms['prompt-setting'].can_save);
    savePromptBtn.disabled = !canSavePrompt;
  }
  const gptSaveBtn = document.getElementById('save-gpt-btn');
  if (gptSaveBtn) {
    const canSaveGpt = isSuper || (perms['gpt-setting'] && perms['gpt-setting'].can_save);
    gptSaveBtn.disabled = !canSaveGpt;
  }
  const startUpload = document.getElementById('start-upload');
  if (startUpload) {
    const canSaveData = isSuper || (perms['data-setting'] && perms['data-setting'].can_save);
    startUpload.disabled = !canSaveData;
  }
  
  // 참조데이터 토글 버튼 권한 제어
  const toggleReferences = document.getElementById('toggle-references');
  const toggleDownloadButton = document.getElementById('toggle-download-button');
  
  if (toggleReferences) {
    const canSaveReference = isSuper || (perms['reference-data'] && perms['reference-data'].can_save);
    toggleReferences.disabled = !canSaveReference;
    
    // 저장 권한이 없으면 토글 상태를 읽기 전용으로 설정
    if (!canSaveReference) {
      toggleReferences.style.opacity = '0.5';
      toggleReferences.style.cursor = 'not-allowed';
    } else {
      toggleReferences.style.opacity = '1';
      toggleReferences.style.cursor = 'pointer';
    }
  }
  
  if (toggleDownloadButton) {
    const canSaveReference = isSuper || (perms['reference-data'] && perms['reference-data'].can_save);
    toggleDownloadButton.disabled = !canSaveReference;
    
    // 저장 권한이 없으면 토글 상태를 읽기 전용으로 설정
    if (!canSaveReference) {
      toggleDownloadButton.style.opacity = '0.5';
      toggleDownloadButton.style.cursor = 'not-allowed';
    } else {
      toggleDownloadButton.style.cursor = 'pointer';
      toggleDownloadButton.style.opacity = '1';
    }
  }
}

async function apiGet(path) {
  const res = await fetch(path, { headers: authHeaders(), credentials: 'same-origin' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.detail || '요청 실패');
  return json;
}

async function apiPost(path, body) {
  const res = await fetch(path, { method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'same-origin' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.detail || '요청 실패');
  return json;
}

async function apiDelete(path) {
  const res = await fetch(path, { method: 'DELETE', headers: authHeaders(), credentials: 'same-origin' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.detail || '요청 실패');
  return json;
}

function authHeaders() {
  const headers = { 'Accept': 'application/json' };
  return headers;
}

// ===== Super Admin Panel =====
let adminUsersCache = null;
let adminUsersCacheTime = 0;
const CACHE_DURATION = 30000; // 30초 캐시

async function renderAdminPanel() {
  try {
    if (!currentUserInfo || !currentUserInfo.is_super_admin) return;
    
    console.log('Rendering admin panel...');
    
    // 즉시 기본 UI 렌더링
    renderAdminPanelUI();
    
    // 백그라운드에서 데이터 로딩
    loadAdminDataAsync();
  } catch (e) {
    console.error(e);
    showNotification(e.message || '관리자 패널 로드 실패', 'error');
  }
}

// 관리자 패널 UI 즉시 렌더링
function renderAdminPanelUI() {
  const listWrap = document.getElementById('admin-users-list');
  const permsGrid = document.getElementById('perms-grid');
  
  if (listWrap) {
    listWrap.innerHTML = `
      <div style="padding: 1rem; text-align: center; color: #9ca3af;">
        <div style="margin-bottom: 0.5rem;">관리자 목록을 불러오는 중...</div>
        <div style="font-size: 0.875rem;">잠시만 기다려주세요</div>
                    </div>
    `;
  }
  
  if (permsGrid) {
    permsGrid.innerHTML = `
      <div style="padding: 1rem; text-align: center; color: #9ca3af;">
        <div style="margin-bottom: 0.5rem;">권한 설정을 불러오는 중...</div>
        <div style="font-size: 0.875rem;">잠시만 기다려주세요</div>
                    </div>
    `;
  }
  
  // 이벤트 핸들러 설정
  setupAdminEventHandlers();
}

// 백그라운드에서 관리자 데이터 로딩
async function loadAdminDataAsync() {
  try {
    // 캐시된 데이터가 있고 유효한 경우 사용
    const now = Date.now();
    if (adminUsersCache && (now - adminUsersCacheTime) < CACHE_DURATION) {
      renderAdminUsers(adminUsersCache);
      return;
    }
    
    // 새로운 데이터 로딩
    const usersRes = await apiGet('/api/admin/users');
    const users = usersRes.data || [];
    
    // 캐시 업데이트
    adminUsersCache = users;
    adminUsersCacheTime = now;
    
    // UI 업데이트
    renderAdminUsers(users);
    
  } catch (e) {
    console.error('관리자 데이터 로딩 실패:', e);
    showNotification('관리자 데이터를 불러오는데 실패했습니다.', 'error');
  }
}

// 관리자 사용자 목록 렌더링
function renderAdminUsers(users) {
  const listWrap = document.getElementById('admin-users-list');
  if (!listWrap) return;
  
  if (users.length === 0) {
    listWrap.innerHTML = `
      <div style="padding: 1rem; text-align: center; color: #9ca3af;">
        등록된 관리자가 없습니다.
      </div>
    `;
    return;
  }
  
  listWrap.innerHTML = users.map(u => `
    <div class="admin-user-item" data-username="${u.username}">
      <div class="admin-user-info">
        <div class="admin-user-name">${u.username}</div>
        <div class="admin-user-role">${u.is_super_admin ? '최고관리자' : '관리자'}</div>
      </div>
      <button class="admin-action-btn select" data-username="${u.username}">선택</button>
    </div>
  `).join('');
  
  // 선택 버튼 이벤트 리스너
  listWrap.querySelectorAll('.select').forEach(btn => {
    btn.addEventListener('click', async () => {
      const target = btn.getAttribute('data-username');
      document.getElementById('new-admin-username').value = target;
      document.getElementById('new-admin-password').value = '';
      document.getElementById('new-admin-super').checked = !!users.find(x => x.username === target)?.is_super_admin;
      
      // 권한 로딩 (캐시 활용)
      await loadUserPermissionsAsync(target);
    });
  });
}

// 사용자 권한 비동기 로딩
async function loadUserPermissionsAsync(username) {
  const permsGrid = document.getElementById('perms-grid');
  if (!permsGrid) return;
  
  try {
    permsGrid.innerHTML = `
      <div style="padding: 1rem; text-align: center; color: #9ca3af;">
        <div style="margin-bottom: 0.5rem;">권한을 불러오는 중...</div>
        <div style="font-size: 0.875rem;">잠시만 기다려주세요</div>
      </div>
    `;
    
    const res = await apiGet(`/api/admin/permissions/${encodeURIComponent(username)}`);
    const perms = res.data || {};
    
    renderUserPermissions(username, perms);
  } catch (e) {
    console.error('권한 로딩 실패:', e);
    permsGrid.innerHTML = `
      <div style="padding: 1rem; text-align: center; color: #dc2626;">
        권한을 불러오는데 실패했습니다.
        <button onclick="loadUserPermissionsAsync('${username}')" style="margin-left: 0.5rem; padding: 0.25rem 0.5rem; background: #dc2626; color: white; border: none; border-radius: 4px; cursor: pointer;">다시 시도</button>
      </div>
    `;
  }
}

// 사용자 권한 렌더링
function renderUserPermissions(username, perms) {
  const permsGrid = document.getElementById('perms-grid');
  if (!permsGrid) return;
  
  const categories = currentUserInfo?.categories || ['chatbot-connect','chat-history','gpt-setting','prompt-setting','data-setting','reference-data'];
  
  permsGrid.innerHTML = categories.map(cat => {
    const item = perms[cat] || { can_view: false, can_save: false };
    const idView = `perm-${cat}-view`;
    const idSave = `perm-${cat}-save`;
    return `
      <div class="perm-item">
        <div class="perm-category">${cat}</div>
        <div class="perm-controls">
          <div class="perm-toggle">
            <span>조회</span>
            <label class="toggle-switch">
              <input type="checkbox" id="${idView}" ${item.can_view ? 'checked' : ''}>
              <span class="toggle-slider round"></span>
            </label>
          </div>
          <div class="perm-toggle">
            <span>저장</span>
            <label class="toggle-switch">
              <input type="checkbox" id="${idSave}" ${item.can_save ? 'checked' : ''} ${!item.can_view ? 'disabled' : ''}>
              <span class="toggle-slider round"></span>
            </label>
          </div>
        </div>
      </div>
    `;
      }).join('');
  
  // 조회 권한 변경 시 저장 권한 자동 제어
  categories.forEach(cat => {
    const viewCheckbox = document.getElementById(`perm-${cat}-view`);
    const saveCheckbox = document.getElementById(`perm-${cat}-save`);
    
    if (viewCheckbox && saveCheckbox) {
      viewCheckbox.addEventListener('change', function() {
        if (!this.checked) {
          // 조회를 끄면 저장도 끄기
          saveCheckbox.checked = false;
          saveCheckbox.disabled = true;
        } else {
          // 조회를 켜면 저장 활성화
          saveCheckbox.disabled = false;
        }
      });
      
      // 초기 상태 설정
      if (!viewCheckbox.checked) {
        saveCheckbox.disabled = true;
      }
    }
  });
  
  // 권한 저장 버튼 이벤트 리스너
  const savePermsBtn = document.getElementById('save-permissions');
  if (savePermsBtn) {
    savePermsBtn.onclick = async () => {
      try {
        setSaveButtonLoading(savePermsBtn, true);
        
        const payload = { username, permissions: [] };
        categories.forEach(cat => {
          const view = document.getElementById(`perm-${cat}-view`);
          const save = document.getElementById(`perm-${cat}-save`);
          if (view && save) {
            payload.permissions.push({ category: cat, can_view: view.checked, can_save: save.checked });
          }
        });
        
        await apiPost('/api/admin/permissions', payload);
        
        // 캐시 무효화
        adminUsersCache = null;
        adminUsersCacheTime = 0;
        
        showNotification('권한 저장 완료', 'success');
        
                // 자신의 권한을 업데이트한 경우 UI 새로고침
        if (currentUserInfo?.username === username) {
          const me = await apiGet('/api/admin/me');
          currentUserInfo = me.data;
          applyPermissionsToUI();
          
          // 참조데이터 토글 버튼 권한 재설정
          const toggleReferences = document.getElementById('toggle-references');
          const toggleDownloadButton = document.getElementById('toggle-download-button');
          
          if (toggleReferences && toggleDownloadButton) {
            const canSaveReference = currentUserInfo.is_super_admin || (currentUserInfo.permissions && currentUserInfo.permissions['reference-data'] && currentUserInfo.permissions['reference-data'].can_save);
            
            toggleReferences.disabled = !canSaveReference;
            toggleDownloadButton.disabled = !canSaveReference;
            
            if (!canSaveReference) {
              toggleReferences.style.opacity = '0.5';
              toggleReferences.style.cursor = 'not-allowed';
              toggleDownloadButton.style.opacity = '0.5';
              toggleDownloadButton.style.cursor = 'not-allowed';
            } else {
              toggleReferences.style.opacity = '1';
              toggleReferences.style.cursor = 'pointer';
              toggleDownloadButton.style.opacity = '1';
              toggleDownloadButton.style.cursor = 'pointer';
            }
          }
        }
  } catch (e) {
        console.error('권한 저장 실패:', e);
        showNotification(e.message || '권한 저장에 실패했습니다.', 'error');
      } finally {
        setSaveButtonLoading(savePermsBtn, false);
      }
    };
  }
}

// 관리자 이벤트 핸들러 설정
function setupAdminEventHandlers() {
  // 저장 버튼
  const saveBtn = document.getElementById('save-admin-user');
  if (saveBtn) {
    saveBtn.onclick = async () => {
      try {
        setSaveButtonLoading(saveBtn, true);
        
        const username = document.getElementById('new-admin-username').value.trim();
        const password = document.getElementById('new-admin-password').value;
        const isSuper = document.getElementById('new-admin-super').checked;
        
        if (!username || !password) { 
          showNotification('아이디/비밀번호를 입력하세요', 'error'); 
          return; 
        }
        
        await apiPost('/api/admin/users', { username, password, is_super_admin: isSuper });
        
        // 캐시 무효화
        adminUsersCache = null;
        adminUsersCacheTime = 0;
        
        showNotification('관리자 저장 완료', 'success');
        
        // 관리자 목록 새로고침
        await loadAdminDataAsync();
        
      } catch (e) {
        console.error('관리자 저장 실패:', e);
        showNotification(e.message || '관리자 저장에 실패했습니다.', 'error');
      } finally {
        setSaveButtonLoading(saveBtn, false);
      }
    };
  }
  
  // 삭제 버튼
  const delBtn = document.getElementById('delete-admin-user');
  if (delBtn) {
    delBtn.onclick = async () => {
      try {
        setSaveButtonLoading(delBtn, true);
        
        const username = document.getElementById('new-admin-username').value.trim();
        if (!username) { 
          showNotification('삭제할 아이디를 입력하세요', 'error'); 
          return; 
        }
        
        // 확인 대화상자
        if (!confirm(`정말로 관리자 '${username}'을(를) 삭제하시겠습니까?`)) {
          return;
        }
        
        await apiDelete(`/api/admin/users/${encodeURIComponent(username)}`);
        
        // 캐시 무효화
        adminUsersCache = null;
        adminUsersCacheTime = 0;
        
        showNotification('관리자 삭제 완료', 'success');
        
        // 폼 초기화
        document.getElementById('new-admin-username').value = '';
        document.getElementById('new-admin-password').value = '';
        document.getElementById('new-admin-super').checked = false;
        
        // 권한 그리드 초기화
        const permsGrid = document.getElementById('perms-grid');
        if (permsGrid) {
          permsGrid.innerHTML = `
            <div style="padding: 1rem; text-align: center; color: #9ca3af;">
              관리자를 선택하면 권한을 설정할 수 있습니다.
            </div>
          `;
        }
        
        // 관리자 목록 새로고침
        await loadAdminDataAsync();
        
      } catch (e) {
        console.error('관리자 삭제 실패:', e);
        showNotification(e.message || '관리자 삭제에 실패했습니다.', 'error');
      } finally {
        setSaveButtonLoading(delBtn, false);
      }
    };
  }
}

// 로그인하지 않은 상태로 UI 숨김
function hideLoggedInUI() {
  const chatContainer = document.querySelector('.chat-container');
  const sidebar = document.getElementById('sidebar');
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  
  if (chatContainer) chatContainer.classList.add('not-logged-in');
  if (sidebar) sidebar.classList.add('not-logged-in');
  if (hamburgerBtn) hamburgerBtn.classList.add('not-logged-in');
}

// 로그인 상태로 UI 표시
function showLoggedInUI() {
  const chatContainer = document.querySelector('.chat-container');
  const sidebar = document.getElementById('sidebar');
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  
  if (chatContainer) chatContainer.classList.remove('not-logged-in');
  if (sidebar) sidebar.classList.remove('not-logged-in');
  if (hamburgerBtn) hamburgerBtn.classList.remove('not-logged-in');
}