/* eslint
    no-console: 0,
    no-param-reassign: 0,
    no-use-before-define: ["error", { "variables": false }],
    no-return-assign: 0,
    react/no-string-refs: 0
*/

import PropTypes from 'prop-types';
import React from 'react';

import { Easing, Animated, TouchableOpacity, ListView, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons'

import shallowequal from 'shallowequal';
import InvertibleScrollView from 'react-native-invertible-scroll-view';
import md5 from 'md5';
import LoadEarlier from './LoadEarlier';
import Message from './Message';

export default class MessageContainer extends React.Component {

  constructor(props) {
    super(props);

    this.renderRow = this.renderRow.bind(this);
    this.renderFooter = this.renderFooter.bind(this);
    this.renderLoadEarlier = this.renderLoadEarlier.bind(this);
    this.renderScrollComponent = this.renderScrollComponent.bind(this);

    const dataSource = new ListView.DataSource({
      rowHasChanged: (r1, r2) => {
        return r1.hash !== r2.hash;
      },
    });

    const messagesData = this.prepareMessages(props.messages);
    this.state = {
      dataSource: dataSource.cloneWithRows(messagesData.blob, messagesData.keys),
      showScrollToBottomButton: false,
      animatingScrollToBottomButton: false
    };

    this.animatedValue = new Animated.Value(0)
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.messages === nextProps.messages) {
      return;
    }
    const messagesData = this.prepareMessages(nextProps.messages);
    this.setState({
      dataSource: this.state.dataSource.cloneWithRows(messagesData.blob, messagesData.keys),
    });
  }

  shouldComponentUpdate(nextProps, nextState) {
    if (!shallowequal(this.props, nextProps)) {
      return true;
    }
    if (!shallowequal(this.state, nextState)) {
      return true;
    }
    return false;
  }

  prepareMessages(messages) {
    return {
      keys: messages.map((m) => m._id),
      blob: messages.reduce((o, m, i) => {
        const previousMessage = messages[i + 1] || {};
        const nextMessage = messages[i - 1] || {};
        // add next and previous messages to hash to ensure updates
        const toHash = JSON.stringify(m) + previousMessage._id + nextMessage._id;
        o[m._id] = {
          ...m,
          previousMessage,
          nextMessage,
          hash: md5(toHash),
        };
        return o;
      }, {}),
    };
  }

  scrollTo(options) {
    this._invertibleScrollViewRef.scrollTo(options);
  }

  scrollToEnd(options) {
    this._invertibleScrollViewRef.getScrollResponder().scrollToEnd(options)
  }

  renderLoadEarlier() {
    if (this.props.loadEarlier === true) {
      const loadEarlierProps = {
        ...this.props,
      };
      if (this.props.renderLoadEarlier) {
        return this.props.renderLoadEarlier(loadEarlierProps);
      }
      return <LoadEarlier {...loadEarlierProps} />;
    }
    return null;
  }

  renderFooter() {
    if (this.props.renderFooter) {
      const footerProps = {
        ...this.props,
      };
      return this.props.renderFooter(footerProps);
    }
    return null;
  }

  renderRow(message) {
    if (!message._id && message._id !== 0) {
      console.warn('GiftedChat: `_id` is missing for message', JSON.stringify(message));
    }
    if (!message.user) {
      if (!message.system) {
        console.warn('GiftedChat: `user` is missing for message', JSON.stringify(message));
      }
      message.user = {};
    }

    const messageProps = {
      ...this.props,
      key: message._id,
      currentMessage: message,
      previousMessage: message.previousMessage,
      nextMessage: message.nextMessage,
      position: message.user._id === this.props.user._id ? 'right' : 'left',
    };

    if (this.props.renderMessage) {
      return this.props.renderMessage(messageProps);
    }
    return <Message {...messageProps} />;
  }

  renderScrollComponent(props) {
    const { invertibleScrollViewProps } = this.props;
    return (
      <InvertibleScrollView
        {...props}
        {...invertibleScrollViewProps}
        ref={(component) => (this._invertibleScrollViewRef = component)}
      />
    );
  }

  _onScroll = event => {
    if (!this.props.scrollToBottom) {
      return
    }

    const yOffset = event.nativeEvent.contentOffset.y
    const {
      showScrollToBottomButton: prevShowScrollToBottomButton,
      animatingScrollToBottomButton
    } = this.state
    const showScrollToBottomButton = yOffset > 150

    if (
      prevShowScrollToBottomButton !== showScrollToBottomButton &&
      !animatingScrollToBottomButton
    ) {
      Animated.timing(this.animatedValue).stop()

      if (showScrollToBottomButton) {
        // showing the button
        this.setState({
          showScrollToBottomButton,
          animatingScrollToBottomButton: true
        })

        Animated.timing(this.animatedValue, {
          toValue: 1,
          easing: Easing.in,
          duration: 150
        }).start(() => {
          this.setState({ animatingScrollToBottomButton: false })
        })
      } else {
        // hiding the button
        this.setState({ animatingScrollToBottomButton: true })
        Animated.timing(this.animatedValue, {
          toValue: 0,
          easing: Easing.in,
          duration: 100
        }).start(() => {
          this.setState({
            showScrollToBottomButton,
            animatingScrollToBottomButton: false
          })
        })
      }
    }
  }

  _onScrollToBottomPress = () => {
    this.setState({ animatingScrollToBottomButton: true })

    const { inverted } = this.props
    if (inverted) {
      this.scrollTo({ y: 0, animated: true })
    } else {
      this.scrollToEnd({ animated: true })
    }

    Animated.timing(this.animatedValue, {
      toValue: 0,
      easing: Easing.in,
      duration: 100
    }).start(() => {
      this.setState({ showScrollToBottomButton: false })
    })

    setTimeout(() => {
      this.setState({ animatingScrollToBottomButton: false })
    }, 1000)
  }

  render() {
    const contentContainerStyle = this.props.inverted
      ? {}
      : styles.notInvertedContentContainerStyle;
    const { showScrollToBottomButton } = this.state
    const animatedStyle = {
      transform: [{ scale: this.animatedValue }]
    }

    return (
      <View style={styles.container}>
        <ListView
          enableEmptySections
          automaticallyAdjustContentInsets={false}
          initialListSize={20}
          pageSize={20}
          {...this.props.listViewProps}
          dataSource={this.state.dataSource}
          contentContainerStyle={contentContainerStyle}
          renderRow={this.renderRow}
          renderHeader={this.props.inverted ? this.renderFooter : this.renderLoadEarlier}
          renderFooter={this.props.inverted ? this.renderLoadEarlier : this.renderFooter}
          renderScrollComponent={this.renderScrollComponent}
          onScroll={this._onScroll}
          scrollEventThrottle={100}
        />
        {showScrollToBottomButton && (
          <TouchableOpacity style={styles.scrollToBottomTouchable} onPress={this._onScrollToBottomPress}>
            <Animated.View style={[ styles.scrollToBottomButton, animatedStyle ]}>
              <Ionicons
                style={styles.icon}
                name={'ios-arrow-down'}
                size={24}
              />
            </Animated.View>
          </TouchableOpacity>
        )}
      </View>
    );
  }

}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  notInvertedContentContainerStyle: {
    justifyContent: 'flex-end',
  },
  scrollToBottomTouchable: {
    position: 'absolute',
    bottom: 14,
    right: 12,
    zIndex: 1
  },
  scrollToBottomButton: {
    opacity: 0.8,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 6
  },
  icon: {
    marginTop: 4
  }
});

MessageContainer.defaultProps = {
  messages: [],
  user: {},
  renderFooter: null,
  renderMessage: null,
  onLoadEarlier: () => { },
  inverted: true,
  loadEarlier: false,
  listViewProps: {},
  invertibleScrollViewProps: {},
};

MessageContainer.propTypes = {
  messages: PropTypes.arrayOf(PropTypes.object),
  user: PropTypes.object,
  renderFooter: PropTypes.func,
  renderMessage: PropTypes.func,
  renderLoadEarlier: PropTypes.func,
  onLoadEarlier: PropTypes.func,
  listViewProps: PropTypes.object,
  inverted: PropTypes.bool,
  loadEarlier: PropTypes.bool,
  invertibleScrollViewProps: PropTypes.object,
};
