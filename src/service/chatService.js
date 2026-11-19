import axiosClient from '../config/axiosClient';

const chatService = {
  sendMessage: ({ sessionToken = null, accountId = null, message }) => {
    return axiosClient.post('/api/chat', {
      sessionToken,
      accountId,
      message,
    });
  },
};

export default chatService;